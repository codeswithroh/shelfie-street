"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, DotHistogram, Funnel, HatchRows, Kpi, PALETTE, SegmentBar, StepArea, TickBar } from "@/components/charts";
import { Chip, Empty, usd, useStreet } from "@/components/street";

const bucket = (dates: string[], n: number, spanMs: number) => {
  const now = Date.now();
  const out = Array<number>(n).fill(0);
  for (const d of dates) {
    const i = n - 1 - Math.floor((now - new Date(d).getTime()) / (spanMs / n));
    if (i >= 0 && i < n) out[i]++;
  }
  return out;
};

export default function Overview() {
  const { data, error, reload } = useStreet();
  const [seeding, setSeeding] = useState(false);
  if (error) return <Empty>{error}</Empty>;
  if (!data) return <Empty>Loading…</Empty>;
  if (!data.shops.length) {
    return (
      <div className="card p-8 text-center">
        <button className="btn btn-accent" disabled={seeding} onClick={async () => { setSeeding(true); await fetch("/api/street/seed", { method: "POST" }); await reload(); setSeeding(false); }}>
          {seeding ? "Opening 6 shops…" : "Open the demo street"}
        </button>
      </div>
    );
  }
  const m = data.missions, L = data.ledger;
  const sum = (t: string) => L.filter((e) => e.type === t).reduce((s, e) => s + e.amount_cents, 0);
  const count = (t: string) => L.filter((e) => e.type === t).length;
  const authorized = sum("AUTHORIZED"), captured = sum("CAPTURED"), paid = sum("PAID_OUT");
  const released = m.filter((x) => ["SETTLED", "ABORTED"].includes(x.status)).reduce((s, x) => s + x.authorized_cents - x.captured_cents, 0);
  const screened = data.firewall.length, blocked = data.firewall.filter((f) => f.verdict === "BLOCKED").length;
  const earners = data.shops.filter((s) => s.earned_cents > 0);
  const stock = data.shops.reduce((s, x) => s + x.stock, 0);
  const statuses = ["AWAITING_APPROVAL", "AWAITING_PROOF", "SETTLED", "ABORTED"];
  const day = 864e5;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Captured" value={usd(captured)} icon="$" />
        <Kpi label="Released to buyers" value={usd(released)} icon="↩" color="#16a06a" />
        <Kpi label="Auto recoveries" value={String(count("SUBSTITUTED"))} icon="⟳" color="#ff9d42" />
        <Kpi label="Attacks blocked" value={String(blocked)} icon="⛨" color="#f062a8" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.75fr_1fr]">
        <Card title="Money flow" right={<Link className="text-sm text-ink-3 hover:text-ink" href="/app/ledger">↗</Link>}>
          <Funnel stages={[
            { label: "Authorized", cents: authorized, color: "#2f6bff" },
            { label: "Captured", cents: captured, color: "#7b5cff" },
            { label: "Paid to shops", cents: paid, color: "#16a06a" },
            { label: "Released", cents: released, color: "#ff9d42" },
          ]} />
        </Card>
        <div className="g-sheen flex min-h-64 flex-col justify-between rounded-[18px] p-5 text-white">
          <span className="w-fit rounded-full bg-white/20 px-2.5 py-1 text-xs">Firewall</span>
          <div>
            <div className="text-6xl font-semibold tracking-tight">{screened ? Math.round((blocked / screened) * 100) : 0}%</div>
            <div className="mt-1 text-sm text-white/85">of {screened} agent messages blocked</div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/25"><div className="g-grow-x h-full rounded-full bg-white" style={{ width: `${screened ? (blocked / screened) * 100 : 0}%` }} /></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Shop earnings">
          {earners.length ? <HatchRows rows={earners.map((s, i) => ({ label: s.name, value: s.earned_cents, display: usd(s.earned_cents), color: PALETTE[i % 6] }))} />
            : <HatchRows rows={data.shops.slice(0, 4).map((s, i) => ({ label: s.name, value: s.stock, display: `${s.stock} units`, color: PALETTE[i % 6] }))} />}
        </Card>
        <Card title="Ledger activity" right={<span className="text-2xl font-semibold tracking-tight">{L.length}</span>}>
          <DotHistogram values={bucket(L.map((e) => e.created_at), 28, 7 * day)} />
          <div className="mt-1 flex justify-between text-xs text-ink-3"><span>7 days ago</span><span>Now</span></div>
        </Card>
        <Card title="Agent traffic" right={<span className="text-2xl font-semibold tracking-tight">{data.agents.length}</span>}>
          <StepArea values={bucket(data.firewall.map((f) => f.created_at), 14, 7 * day)} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <div className="space-y-4">
          <Card title="Missions"><SegmentBar parts={statuses.map((s, i) => ({ label: s.replaceAll("_", " ").toLowerCase(), value: m.filter((x) => x.status === s).length, color: PALETTE[i] }))} /></Card>
          <Card title="Stock on the street" right={<b>{stock}</b>}><TickBar used={stock} total={Math.max(stock, 200)} /></Card>
        </div>
        <Card title="Recent missions" right={<Link className="text-sm text-ink-3 hover:text-ink" href="/app/missions">↗</Link>}>
          <div className="divide-y divide-line">
            {!m.length && <p className="py-6 text-center text-sm text-ink-3">No missions yet</p>}
            {m.slice(0, 6).map((x) => (
              <Link key={x.id} href={`/app/missions/${x.id}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 hover:opacity-70">
                <span className="truncate text-sm font-medium">{x.goal}</span>
                <span className="text-sm font-semibold">{usd(x.captured_cents || x.budget_cents)}</span>
                <Chip s={x.status} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
