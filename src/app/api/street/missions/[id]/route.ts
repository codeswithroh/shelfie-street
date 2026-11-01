import { isOwner } from "@/lib/guard";
import { getShopById } from "@/lib/db";
import { getMission, listLines, missionLedger, verifyChain } from "@/lib/street/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const mission = await getMission((await params).id);
  if (!mission) return Response.json({ error: "Unknown mission" }, { status: 404 });
  const lines = await Promise.all((await listLines(mission.id)).map(async (l) => ({ ...l, shop_name: (await getShopById(l.shop_id))?.name ?? "" })));
  const ledger = await missionLedger(mission.id);
  return Response.json({ mission, lines, ledger, chain: verifyChain(ledger), can_act: isOwner(req, mission.id) });
}
