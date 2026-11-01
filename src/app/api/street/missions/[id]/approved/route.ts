import { isOwner, notOwner } from "@/lib/guard";
import { confirmApproval } from "@/lib/street/saga";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isOwner(req, id)) return notOwner();
  try {
    await confirmApproval(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }
}
