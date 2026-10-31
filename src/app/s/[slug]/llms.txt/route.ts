import { getShop, money } from "@/lib/db";
import { appUrl, listCatalog, shopInfo } from "@/lib/commerce";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const shop = await getShop((await params).slug);
  if (!shop) return new Response("Unknown shop", { status: 404 });
  const info = shopInfo(shop);
  const lines = [
    `# ${shop.name}`,
    `> ${shop.tagline}`,
    "",
    `${info.category} · ${info.location} · ${info.fulfillment} · pays with PayPal`,
    "",
    "## For AI agents",
    `Connect to the MCP server at ${appUrl()}/s/${shop.slug}/mcp to search, quote and order. The buyer approves payment on PayPal.`,
    `Product feed: ${appUrl()}/s/${shop.slug}/feed.json`,
    "",
    "## Products",
    ...(await listCatalog(shop)).map((p) => `- ${p.name} — ${money(p.price_cents, shop.currency)}: ${p.description}`),
    "",
    "## Policies",
    info.policies || "Ask the shop.",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
