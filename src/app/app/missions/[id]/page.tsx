"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Chip, Empty, usd, usePoll } from "@/components/street";
import type { LedgerEntry, Line, Mission } from "@/lib/street/store";

type Detail = { mission: Mission; lines: (Line & { shop_name: string })[]; ledger: LedgerEntry[]; chain: { ok: boolean; brokenAt: number | null } };

const STEPS = ["Mandate", "PayPal approval", "Reserve", "Shop proof", "Capture + payout", "Settled"];
const stepIndex = (m: Mission) => ({ PLANNED: 0, AWAITING_APPROVAL: 1, EXECUTING: 2, AWAITING_PROOF: 3, SETTLED: 6, ABORTED: 0 })[m.status];

function View() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { data, error, reload } = usePoll<Detail>(`/api/street/missions/${id}`, 2000);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const confirmed = useRef(false);

  useEffect(() => {
    if (params.get("approved") !== "1" || confirmed.current) return;
    confirmed.current = true;
    setNotice("PayPal approved. Authorizing and reserving…");
    fetch(`/api/street/missions/${id}/approved`, { method: "POST" }).then(async (r) => {
      setNotice(r.ok ? "" : (await r.json()).error);
      reload();
    });
  }, [params, id, reload]);

  async function act(key: string, url: string, init: RequestInit) {
    setBusy(key); setNotice("");
    const res = await fetch(url, { method: "POST", ...init });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setNotice(json.error ?? "That didn't work");
    else if (json.ok === false) setNotice(`Proof rejected: ${json.proof.reason}`);
    await reload();
    setBusy(null);
  }

  if (error && !data) return <Empty>{error}</Empty>;
  if (!data) return <Empty>Loading mission…</Empty>;
  const { mission: m, lines, ledger, chain } = data;
  const live = lines.filter((l) => !["REPLACED", "RELEASED"].includes(l.status));
  const planned = live.reduce((s, l) => s + l.unit_cents * l.quantity, 0);
  const step = stepIndex(m);
  const pct = (c: number) => `${Math.min(100, (c / m.budget_cents) * 100)}%`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h1 className="font-display text-3xl sm:text-4xl">{m.goal}</h1><p className="text-sm text-ink-3">For {m.buyer}</p></div>
        <Chip s={m.status} />
      </header>

      {m.status === "AWAITING_APPROVAL" && (
        <button disabled={busy === "approve"} className="flex w-full items-center justify-between rounded-[14px] bg-[#ffc439] px-5 py-4 text-left font-semibold text-[#111]" onClick={async () => {
          setBusy("approve"); setNotice("");
          const res = await fetch(`/api/street/missions/${id}/approval`, { method: "POST" });
          const json = await res.json();
          if (res.ok) { window.location.href = json.url; return; }
          setNotice(json.error); setBusy(null);
        }}>
          <span>{busy === "approve" ? "Opening PayPal…" : `Approve up to ${usd(m.budget_cents)} on PayPal`}</span><span>→</span>
        </button>
      )}
      {m.status === "ABORTED" && <div className="rounded-[14px] bg-[#f6dcd3] px-5 py-3 text-sm text-tomato-ink">{m.failure}. Buyer charged {usd(m.captured_cents)}.</div>}
      {notice && <div className="rounded-[14px] bg-butter/60 px-5 py-3 text-sm">{notice}</div>}

      <section className="card p-5">
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {STEPS.map((s, i) => (
            <li key={s} className="text-center text-xs font-medium">
              <div className={`mx-auto mb-1 grid h-8 w-8 place-items-center rounded-full ${i < step ? "bg-sage text-white" : i === step ? "bg-tomato text-white" : "bg-paper-2 text-ink-3"}`}>{i < step ? "✓" : i + 1}</div>
              {s}
            </li>
          ))}
        </ol>
        <div className="mt-5">
          <div className="flex justify-between text-xs text-ink-3"><span>Basket {usd(planned)}</span><span>Ceiling {usd(m.budget_cents)}</span></div>
          <div className="relative mt-1 h-3 overflow-hidden rounded-full bg-paper-2">
            <div className="absolute inset-y-0 left-0 bg-butter" style={{ width: pct(planned) }} />
            <div className="absolute inset-y-0 left-0 bg-sage" style={{ width: pct(m.captured_cents) }} />
          </div>
          <div className="mt-1 font-mono text-xs text-ink-2">Captured {usd(m.captured_cents)} · Agent headroom {usd(m.budget_cents - planned)}</div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-3">
          {m.needs.map((n) => (
            <div key={n.key} className="card p-4">
              <div className="label">{n.label}</div>
              <div className="space-y-2">
                {lines.filter((l) => l.need_key === n.key).map((l) => {
                  const dead = ["REPLACED", "RELEASED"].includes(l.status);
                  const canAct = m.status === "AWAITING_PROOF" && ["RESERVED", "PROOF_REJECTED"].includes(l.status);
                  return (
                    <div key={l.id} className={`rounded-lg border border-line p-3 ${dead ? "opacity-50" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0"><div className={`truncate font-semibold ${dead ? "line-through" : ""}`}>{l.shop_name}</div><div className="truncate text-sm text-ink-2">{l.quantity}× {l.product_name}</div></div>
                        <div className="flex shrink-0 items-center gap-2"><span className="tag">{usd(l.unit_cents * l.quantity)}</span><Chip s={l.status} /></div>
                      </div>
                      {l.proof && <p className={`mt-2 text-xs ${l.proof.ok ? "text-sage" : "text-tomato-ink"}`}>{l.proof.reason}</p>}
                      {canAct && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <label className={`btn btn-primary cursor-pointer px-3 py-1.5 text-xs ${busy ? "pointer-events-none opacity-50" : ""}`}>
                            {busy === `p${l.id}` ? "Checking photo…" : "Upload packing photo"}
                            <input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => {
                              const f = e.target.files?.[0]; if (!f) return;
                              const body = new FormData(); body.append("photo", f);
                              act(`p${l.id}`, `/api/street/lines/${l.id}/proof`, { body });
                            }} />
                          </label>
                          <button className="btn btn-ghost px-3 py-1.5 text-xs" disabled={!!busy} onClick={() => act(`f${l.id}`, `/api/street/lines/${l.id}/fail`, { headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: `${l.shop_name} sold out` }) })}>
                            {busy === `f${l.id}` ? "Agent re-planning…" : "Shop sold out"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
        <aside className="card self-start p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Ledger</h2>
            <span className={`pill ${chain.ok ? "bg-sage-soft text-sage" : "bg-[#f6dcd3] text-tomato-ink"}`}>{chain.ok ? `chain intact · ${ledger.length}` : `broken at ${chain.brokenAt}`}</span>
          </div>
          <ol className="mt-3 space-y-3">
            {ledger.slice().reverse().map((e) => (
              <li key={e.id} className="border-l-2 border-line pl-3 text-sm">
                <div className="flex justify-between gap-2 font-medium"><span>{e.type.replaceAll("_", " ").toLowerCase()}</span><span className="font-mono text-xs">{e.amount_cents ? usd(Math.abs(e.amount_cents)) : ""}</span></div>
                <div className="text-xs text-ink-2">{e.detail}</div>
                <div className="font-mono text-[10px] text-ink-3">{e.hash.slice(0, 12)}</div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<Empty>Loading mission…</Empty>}><View /></Suspense>;
}
