"use client";

import { Empty, useStreet } from "@/components/street";

export default function Demand() {
  const { data } = useStreet();
  if (!data) return <Empty>Loading demand…</Empty>;
  const max = Math.max(1, ...data.gaps.map((g) => g.count));
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Street demand gaps</h1>
      <p className="text-sm text-ink-3">What agents asked for that no matching product covered.</p>
      {!data.gaps.length && <Empty>No gaps yet.</Empty>}
      <div className="grid gap-3 md:grid-cols-2">
        {data.gaps.map((g) => (
          <div key={g.label} className="card p-4">
            <div className="flex justify-between gap-2"><b className="capitalize">{g.label}</b><span className="tag">×{g.count}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-2"><div className="h-full bg-tomato" style={{ width: `${(g.count / max) * 100}%` }} /></div>
            <div className="mt-2 text-xs text-ink-3">Asked at {g.shops.join(", ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
