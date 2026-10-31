"use client";

import Link from "next/link";
import { Empty, usd, useStreet } from "@/components/street";

export default function Shops() {
  const { data } = useStreet();
  if (!data) return <Empty>Loading shops…</Empty>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="font-display text-4xl">Shops</h1><Link href="/onboard" className="btn btn-primary py-2 text-sm">Add a shop from a photo</Link></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.shops.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex justify-between"><span className="pill bg-paper-2 capitalize text-ink-2">{s.category}</span><span className="font-mono text-xs text-ink-3">{s.items} items</span></div>
            <h2 className="font-display mt-2 text-2xl">{s.name}</h2>
            <div className="font-display text-3xl text-sage">{usd(s.earned_cents)}</div>
            <div className="text-xs text-ink-3">{s.lines} paid lines</div>
            <div className="mt-3 flex gap-2">
              <Link className="btn btn-ghost px-3 py-1.5 text-xs" href={`/dashboard/${s.slug}`}>Manage</Link>
              <Link className="btn btn-ghost px-3 py-1.5 text-xs" href={`/s/${s.slug}/try`}>Shop as agent</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
