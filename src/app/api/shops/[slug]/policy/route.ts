import { z } from "zod";
import { getShop, updateShopPolicy } from "@/lib/db";

const Body = z.object({ policy: z.string(), auto_refund_limit_cents: z.number().int().min(0) });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const shop = await getShop((await params).slug);
  const body = Body.safeParse(await req.json());
  if (!shop || !body.success) return Response.json({ error: "Bad request" }, { status: 400 });
  await updateShopPolicy(shop.id, body.data.policy, body.data.auto_refund_limit_cents);
  return Response.json({ ok: true });
}
