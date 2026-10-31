import { listDemandGaps, listProducts, query } from "@/lib/db";
import { listAgents, listFirewall } from "@/lib/street/firewall";
import { openShops } from "@/lib/street/saga";
import { allLedger, listMissions } from "@/lib/street/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const shops = await openShops();
  const lineRows = await query("SELECT mission_id, shop_id, status, unit_cents * quantity AS cents FROM mission_lines");
  const shopCards = await Promise.all(shops.map(async (s) => {
    const paid = lineRows.filter((l) => l.shop_id === s.id && l.status === "PAID_OUT");
    return { id: s.id, slug: s.slug, name: s.name, category: s.category, items: (await listProducts(s.id)).length, lines: paid.length, earned_cents: paid.reduce((t, l) => t + Number(l.cents), 0) };
  }));
  const gapMap = new Map<string, { label: string; count: number; shops: string[] }>();
  for (const s of shops) for (const g of await listDemandGaps(s.id)) {
    const cur = gapMap.get(g.label) ?? { label: g.label, count: 0, shops: [] };
    cur.count += g.count; cur.shops.push(s.name); gapMap.set(g.label, cur);
  }
  return Response.json({
    shops: shopCards,
    missions: await listMissions(),
    ledger: await allLedger(),
    firewall: await listFirewall(),
    agents: await listAgents(),
    gaps: [...gapMap.values()].sort((a, b) => b.count - a.count),
  });
}
