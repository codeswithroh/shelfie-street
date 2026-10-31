import { getShop } from "@/lib/db";
import { appUrl, listCatalog, shopInfo } from "@/lib/commerce";

export const dynamic = "force-dynamic";

// Machine-readable product feed for crawlers and agent platforms.
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const shop = await getShop((await params).slug);
  if (!shop) return Response.json({ error: "Unknown shop" }, { status: 404 });
  return Response.json({
    shop: shopInfo(shop),
    mcp_endpoint: `${appUrl()}/s/${shop.slug}/mcp`,
    checkout: "paypal",
    products: await listCatalog(shop),
    updated_at: new Date().toISOString(),
  });
}
