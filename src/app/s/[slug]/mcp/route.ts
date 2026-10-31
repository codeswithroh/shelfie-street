import { getShop } from "@/lib/db";
import { handleMcp } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const shop = await getShop((await params).slug);
  if (!shop) return Response.json({ error: "Unknown shop" }, { status: 404 });
  return handleMcp(shop, req);
}

export { handler as GET, handler as POST, handler as DELETE };
