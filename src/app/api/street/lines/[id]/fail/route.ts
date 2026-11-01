import { getLine } from "@/lib/street/store";
import { isOwner, notOwner } from "@/lib/guard";
import { shopFailure } from "@/lib/street/saga";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const line = await getLine(id);
  if (!line || !isOwner(req, line.mission_id)) return notOwner();
  const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
  try {
    await shopFailure(id, reason || "Shop can no longer fulfil this line");
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }
}
