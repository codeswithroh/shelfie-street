import { createHash } from "node:crypto";
import { newId, now, query, run } from "../db";
import type { Mandate } from "./mandate";

export type Need = { key: string; label: string; category: string; quantity: number; query: string };

export type MissionStatus =
  | "PLANNED" | "AWAITING_APPROVAL" | "EXECUTING" | "AWAITING_PROOF" | "SETTLED" | "ABORTED";

export type LineStatus =
  | "PLANNED" | "RESERVED" | "REPLACED" | "PROOF_REJECTED" | "VERIFIED" | "CAPTURED" | "PAID_OUT" | "RELEASED";

export type Mission = {
  id: string; goal: string; buyer: string; budget_cents: number; status: MissionStatus; needs: Need[];
  mandate: Mandate | null; signature: string | null; paypal_order_id: string | null; approve_url: string | null;
  authorization_id: string | null; authorized_cents: number; captured_cents: number; failure: string | null;
  created_at: string; updated_at: string;
};

export type Line = {
  id: string; mission_id: string; need_key: string; shop_id: string; product_id: string; product_name: string;
  quantity: number; unit_cents: number; status: LineStatus;
  proof: { ok: boolean; found: string[]; missing: string[]; reason: string } | null;
  capture_id: string | null; payout_batch_id: string | null; created_at: string;
};

export type LedgerEntry = {
  id: string; mission_id: string; seq: number; type: string; actor: string; amount_cents: number;
  detail: string; prev_hash: string; hash: string; created_at: string;
};

type Row = Record<string, unknown>;

const toMission = (r: Row): Mission => ({
  ...(r as unknown as Mission),
  needs: JSON.parse(String(r.needs)),
  mandate: r.mandate ? JSON.parse(String(r.mandate)) : null,
});
const toLine = (r: Row): Line => ({ ...(r as unknown as Line), proof: r.proof ? JSON.parse(String(r.proof)) : null });

export async function createMission(goal: string, buyer: string, budgetCents: number, needs: Need[]) {
  const id = newId();
  await run(
    "INSERT INTO missions (id, goal, buyer, budget_cents, status, needs, created_at, updated_at) VALUES (?, ?, ?, ?, 'PLANNED', ?, ?, ?)",
    [id, goal, buyer, budgetCents, JSON.stringify(needs), now(), now()],
  );
  return (await getMission(id))!;
}

export async function getMission(id: string) {
  const r = (await query("SELECT * FROM missions WHERE id = ?", [id]))[0];
  return r ? toMission(r) : null;
}

export async function listMissions() {
  return (await query("SELECT * FROM missions ORDER BY created_at DESC LIMIT 100")).map(toMission);
}

type MissionPatch = Partial<Pick<Mission, "status" | "signature" | "paypal_order_id" | "approve_url" | "authorization_id" | "authorized_cents" | "captured_cents" | "failure">> & { mandate?: Mandate };

export async function updateMission(id: string, patch: MissionPatch) {
  const entries = Object.entries(patch).map(([k, v]) => [k, k === "mandate" ? JSON.stringify(v) : v] as const);
  await run(
    `UPDATE missions SET ${entries.map(([k]) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
    [...entries.map(([, v]) => v as string | number | null), now(), id],
  );
}

/** Moves a mission only if it is still in the expected state, so retries can't run a step twice. */
export async function addCaptured(id: string, cents: number) {
  await run("UPDATE missions SET captured_cents = captured_cents + ?, updated_at = ? WHERE id = ?", [cents, now(), id]);
}

export async function claimMission(id: string, from: MissionStatus, to: MissionStatus) {
  return (await run("UPDATE missions SET status = ?, updated_at = ? WHERE id = ? AND status = ?", [to, now(), id, from])) === 1;
}

export async function addLine(l: Pick<Line, "mission_id" | "need_key" | "shop_id" | "product_id" | "product_name" | "quantity" | "unit_cents">) {
  const id = newId();
  await run(
    `INSERT INTO mission_lines (id, mission_id, need_key, shop_id, product_id, product_name, quantity, unit_cents, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PLANNED', ?)`,
    [id, l.mission_id, l.need_key, l.shop_id, l.product_id, l.product_name, l.quantity, l.unit_cents, now()],
  );
  return id;
}

export async function listLines(missionId: string) {
  return (await query("SELECT * FROM mission_lines WHERE mission_id = ? ORDER BY created_at", [missionId])).map(toLine);
}

export async function getLine(id: string) {
  const r = (await query("SELECT * FROM mission_lines WHERE id = ?", [id]))[0];
  return r ? toLine(r) : null;
}

export async function claimLine(id: string, from: LineStatus[], to: LineStatus) {
  const marks = from.map(() => "?").join(", ");
  return (await run(`UPDATE mission_lines SET status = ? WHERE id = ? AND status IN (${marks})`, [to, id, ...from])) === 1;
}

export async function updateLine(id: string, patch: { proof?: Line["proof"]; capture_id?: string; payout_batch_id?: string }) {
  const entries = Object.entries(patch).map(([k, v]) => [k, k === "proof" ? JSON.stringify(v) : v] as const);
  await run(`UPDATE mission_lines SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`, [...entries.map(([, v]) => v as string | number), id]);
}

export async function reserveStock(productId: string, qty: number) {
  return (await run("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?", [qty, productId, qty])) === 1;
}

export async function releaseStock(productId: string, qty: number) {
  await run("UPDATE products SET stock = stock + ? WHERE id = ?", [qty, productId]);
}

// ---------- tamper-evident ledger ----------

const entryHash = (prev: string, seq: number, missionId: string, type: string, actor: string, cents: number, detail: string, at: string) =>
  createHash("sha256").update([prev, seq, missionId, type, actor, cents, detail, at].join("|")).digest("hex");

export async function appendLedger(missionId: string, type: string, actor: string, amountCents: number, detail: string) {
  // The UNIQUE (mission_id, seq) constraint turns a lost race into a retry, not a forked chain.
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = (await query("SELECT seq, hash FROM ledger WHERE mission_id = ? ORDER BY seq DESC LIMIT 1", [missionId]))[0];
    const seq = last ? Number(last.seq) + 1 : 1;
    const prev = last ? String(last.hash) : "GENESIS";
    const at = now();
    try {
      await run(
        "INSERT INTO ledger (id, mission_id, seq, type, actor, amount_cents, detail, prev_hash, hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [newId(), missionId, seq, type, actor, amountCents, detail, prev, entryHash(prev, seq, missionId, type, actor, amountCents, detail, at), at],
      );
      return;
    } catch (e) {
      if (attempt === 4) throw e;
    }
  }
}

export async function missionLedger(missionId: string) {
  return (await query("SELECT * FROM ledger WHERE mission_id = ? ORDER BY seq", [missionId])) as unknown as LedgerEntry[];
}

export async function allLedger(limit = 300) {
  return (await query("SELECT * FROM ledger ORDER BY created_at DESC LIMIT ?", [limit])) as unknown as LedgerEntry[];
}

export function verifyChain(entries: LedgerEntry[]) {
  let prev = "GENESIS";
  for (const e of entries) {
    const expected = entryHash(prev, e.seq, e.mission_id, e.type, e.actor, e.amount_cents, e.detail, e.created_at);
    if (e.prev_hash !== prev || e.hash !== expected) return { ok: false, brokenAt: e.seq };
    prev = e.hash;
  }
  return { ok: true, brokenAt: null };
}
