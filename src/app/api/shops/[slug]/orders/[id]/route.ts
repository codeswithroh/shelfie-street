import { z } from "zod";
import { getOrder, getShop } from "@/lib/db";
import { fulfillOrder, refund } from "@/lib/commerce";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("fulfill"), carrier: z.string().default(""), tracking_number: z.string().default("") }),
  z.object({ action: z.literal("refund"), amount_cents: z.number().int().positive(), note: z.string().default("Refund from the shop") }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const shop = await getShop(slug);
  const order = await getOrder(id);
  const body = Body.safeParse(await req.json());
  if (!shop || !order || order.shop_id !== shop.id) return Response.json({ error: "Unknown order" }, { status: 404 });
  if (!body.success) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    if (body.data.action === "fulfill") return Response.json(await fulfillOrder(order, body.data.carrier, body.data.tracking_number));
    return Response.json(await refund(order, body.data.amount_cents, body.data.note, "merchant"));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
