import { z } from "zod";
import { clearGap, getShop, listDemandGaps, listProducts } from "@/lib/db";
import { draftProductForGap } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ label: z.string(), action: z.enum(["draft", "dismiss"]) });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const shop = await getShop((await params).slug);
  const body = Body.safeParse(await req.json());
  if (!shop || !body.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const { label, action } = body.data;
  if (action === "dismiss") {
    await clearGap(shop.id, label);
    return Response.json({ ok: true });
  }
  const gap = (await listDemandGaps(shop.id)).find((g) => g.label === label);
  try {
    const draft = await draftProductForGap(shop, await listProducts(shop.id), label, gap?.examples ?? [label]);
    return Response.json({ draft });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
