"use client";

import Link from "next/link";
import { useState } from "react";
import { Chip, Donut, Empty, Stat, usd, useStreet } from "@/components/street";

export default function Overview() {
  const { data, error, reload } = useStreet();
  const [seeding, setSeeding] = useState(false);
  if (error) return <Empty>Couldn&apos;t load the street: {error}</Empty>;
  if (!data) return <Empty>Loading the street…</Empty>;
  if (!data.shops.length) {
    return (
      <div className="card p-8 text-center">
        <h1 className="font-display text-4xl">No shops on the street yet</h1>
        <button className="btn btn-accent mt-4" disabled={seeding} onClick={async () => { setSeeding(true); await fetch("/api/street/seed", { method: "POST" }); await reload(); setSeeding(false); }}>
          {seeding ? "Opening 6 shops…" : "Open the demo street"}
        </button>
      </div>
    );
  }
  const m = data.missions;
  const captured = m.reduce((s, x) => s + x.captured_cents, 0);
  const held = m.filter((x) => ["EXECUTING", "AWAITING_PROOF"].includes(x.status)).reduce((s, x) => s + x.authorized_cents - x.captured_cents, 0);
  const released = m.filter((x) => ["SETTLED", "ABORTED"].includes(x.status)).reduce((s, x) => s + x.authorized_cents - x.captured_cents, 0);
  const blocked = data.firewall.filter((f) => f.verdict === "BLOCKED").length;
  const recoveries = data.ledger.filter((l) => l.type === "SUBSTITUTED").length;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Captured" value={usd(captured)} tone="dark" />
        <Stat label="Live missions" value={String(m.filter((x) => !["SETTLED", "ABORTED"].includes(x.status)).length)} tone="accent" />
        <Stat label="Auto recoveries" value={String(recoveries)} tone="sage" />
        <Stat label="Attacks blocked" value={String(blocked)} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <section className="card min-w-0 p-5">
          <h2 className="font-display text-2xl">Authorized money</h2>
          <div className="mt-3"><Donut center={usd(captured + held + released)} caption="Authorized money by state" parts={[
            { label: "Captured", value: captured, color: "#4f6f52" }, { label: "Held", value: held, color: "#2f5d8a" }, { label: "Released", value: released, color: "#f3d98b" },
          ]} /></div>
        </section>
        <section className="card min-w-0 p-5">
          <div className="flex items-baseline justify-between"><h2 className="font-display text-2xl">Recent missions</h2><Link className="text-sm underline" href="/app/missions">All</Link></div>
          <div className="mt-3 divide-y divide-line">
            {m.length === 0 && <p className="py-6 text-center text-sm text-ink-3">No missions yet.</p>}
            {m.slice(0, 5).map((x) => (
              <Link key={x.id} href={`/app/missions/${x.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-70">
                <span className="min-w-0 truncate text-sm font-medium">{x.goal}</span><span className="shrink-0"><Chip s={x.status} /></span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <section>
        <h2 className="font-display text-2xl">{data.shops.length} shops open</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {data.shops.map((s) => (
            <Link key={s.id} href={`/dashboard/${s.slug}`} className="card p-3 hover:ring-2 hover:ring-butter">
              <div className="truncate text-sm font-semibold">{s.name}</div>
              <div className="text-xs capitalize text-ink-3">{s.category}</div>
              <div className="font-mono mt-2 text-sm">{usd(s.earned_cents)}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
