"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chip, Empty, usd, useStreet } from "@/components/street";

export default function Missions() {
  const router = useRouter();
  const { data } = useStreet();
  const [goal, setGoal] = useState("Birthday party for my daughter on Saturday, 12 kids. Cake, table flowers and balloons.");
  const [buyer, setBuyer] = useState("Maya");
  const [budget, setBudget] = useState("150");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/street/missions", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal, buyer, budget_cents: Math.round(parseFloat(budget) * 100) }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error); setBusy(false); return; }
    router.push(`/app/missions/${json.id}`);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <form onSubmit={start} className="card space-y-3 self-start p-5">
        <h1 className="font-display text-3xl">New mission</h1>
        <div><label className="label">Goal</label><textarea className="input min-h-24" value={goal} onChange={(e) => setGoal(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Buyer</label><input className="input" value={buyer} onChange={(e) => setBuyer(e.target.value)} /></div>
          <div><label className="label">Budget ($)</label><input className="input font-mono" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
        </div>
        {error && <p className="text-sm text-tomato-ink">{error}</p>}
        <button className="btn btn-accent w-full" disabled={busy}>{busy ? "Searching 6 shops…" : "Plan basket"}</button>
      </form>
      <section className="space-y-2">
        {!data?.missions.length && <Empty>Missions you start appear here.</Empty>}
        {data?.missions.map((m) => (
          <Link key={m.id} href={`/app/missions/${m.id}`} className="card flex items-center justify-between gap-3 p-4 hover:ring-2 hover:ring-butter">
            <div className="min-w-0"><div className="truncate font-medium">{m.goal}</div><div className="text-xs text-ink-3">{m.buyer} · up to {usd(m.budget_cents)}</div></div>
            <Chip s={m.status} />
          </Link>
        ))}
      </section>
    </div>
  );
}
