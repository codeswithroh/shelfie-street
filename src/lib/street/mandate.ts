// A mandate is the buyer's signed limit on what an agent may do. Code checks it before
// every spend, so a confused or compromised model cannot exceed it.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";

export type Mandate = {
  mission_id: string;
  buyer: string;
  ceiling_cents: number;
  currency: string;
  categories: string[];
  expires_at: string;
};

declare global {
  var __mandateKey: ReturnType<typeof createPrivateKey> | undefined;
}

function privateKey() {
  if (globalThis.__mandateKey) return globalThis.__mandateKey;
  const pem = process.env.MANDATE_SIGNING_KEY?.replace(/\\n/g, "\n");
  if (pem) return (globalThis.__mandateKey = createPrivateKey(pem));
  if (process.env.VERCEL) throw new Error("MANDATE_SIGNING_KEY is not set");
  // Local development only: a signature from this key won't survive a restart.
  return (globalThis.__mandateKey = generateKeyPairSync("ed25519").privateKey);
}

const canonical = (m: Mandate) =>
  JSON.stringify({
    mission_id: m.mission_id, buyer: m.buyer, ceiling_cents: m.ceiling_cents, currency: m.currency,
    categories: [...m.categories].sort(), expires_at: m.expires_at,
  });

export const signMandate = (m: Mandate) => sign(null, Buffer.from(canonical(m)), privateKey()).toString("base64");

export const verifyMandateSignature = (m: Mandate, signature: string) =>
  verify(null, Buffer.from(canonical(m)), createPublicKey(privateKey()), Buffer.from(signature, "base64"));

export const mandateFingerprint = (signature: string) => createHash("sha256").update(signature).digest("hex").slice(0, 16);

export type SpendCheck = { ok: true } | { ok: false; reason: string };

/** The single gate every planned or actual spend passes through. */
export function checkSpend(m: Mandate, signature: string, spend: { totalCents: number; category: string; now?: Date }): SpendCheck {
  if (!verifyMandateSignature(m, signature)) return { ok: false, reason: "Mandate signature is invalid" };
  if ((spend.now ?? new Date()) > new Date(m.expires_at)) return { ok: false, reason: "Mandate has expired" };
  if (spend.totalCents > m.ceiling_cents) return { ok: false, reason: `Total ${spend.totalCents} exceeds ceiling ${m.ceiling_cents}` };
  if (!m.categories.includes(spend.category)) return { ok: false, reason: `Category "${spend.category}" is not in the mandate` };
  return { ok: true };
}
