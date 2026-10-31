"use client";

import { useState } from "react";
import { Chip, Empty, Stat, useStreet } from "@/components/street";

type Result = { attack: string; agent: string; input: string; ok: boolean; response: string };

export default function Firewall() {
  const { data, reload } = useStreet();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  if (!data) return <Empty>Loading firewall…</Empty>;
  const blocked = data.firewall.filter((f) => f.verdict === "BLOCKED");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl">Agent firewall</h1>
        <button className="btn btn-accent" disabled={busy} onClick={async () => {
          setBusy(true);
          const r = await fetch("/api/street/redteam", { method: "POST" });
          setResults((await r.json()).results ?? []);
          await reload(); setBusy(false);
        }}>{busy ? "Attacking…" : "Run 5 live attacks"}</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Blocked" value={String(blocked.length)} tone="accent" />
        <Stat label="Screened" value={String(data.firewall.length)} />
        <Stat label="Agents banned" value={String(data.agents.filter((a) => a.blocked).length)} tone="dark" />
      </div>
      {results && (
        <section className="card divide-y divide-line">
          {results.map((r) => (
            <div key={r.attack} className="flex items-start gap-3 p-3 text-sm">
              <span className={`pill mt-0.5 shrink-0 ${r.ok ? "bg-butter" : "bg-sage-soft text-sage"}`}>{r.ok ? "reached desk" : "blocked"}</span>
              <div className="min-w-0"><b>{r.attack}</b><div className="truncate text-xs text-ink-3">“{r.input}”</div><div className="mt-1 text-xs text-ink-2">{r.response}</div></div>
            </div>
          ))}
          <div className="p-3 text-sm font-semibold text-sage">Money moved: $0.00</div>
        </section>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-display text-2xl">Agent trust</h2>
          <div className="mt-3 space-y-2">
            {data.agents.length === 0 && <p className="text-sm text-ink-3">No agents seen yet.</p>}
            {data.agents.slice(0, 12).map((a) => (
              <div key={a.name}>
                <div className="flex justify-between text-xs"><span className="truncate">{a.name}</span><span className="font-mono">{a.trust}{a.blocked ? " · banned" : ""}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-paper-2"><div className={`h-full ${a.trust < 40 ? "bg-tomato" : "bg-sage"}`} style={{ width: `${a.trust}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-4">
          <h2 className="font-display text-2xl">Recent screens</h2>
          <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
            {data.firewall.slice(0, 30).map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{f.input}</span><span className="flex shrink-0 gap-1"><span className="pill bg-paper-2 text-ink-2">{f.rule}</span><Chip s={f.verdict} /></span></div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
