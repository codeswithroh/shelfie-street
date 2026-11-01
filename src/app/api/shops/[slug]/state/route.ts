import { isOwner } from "@/lib/guard";
import { getShop, listDemandGaps, listEvents, listOrders, listProducts } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const shop = await getShop((await params).slug);
  if (!shop) return Response.json({ error: "Unknown shop" }, { status: 404 });
  return Response.json({
    shop,
    can_act: isOwner(req, shop.id),
    products: await listProducts(shop.id),
    orders: await listOrders(shop.id),
    events: await listEvents(shop.id, 100),
    gaps: await listDemandGaps(shop.id),
  });
}
