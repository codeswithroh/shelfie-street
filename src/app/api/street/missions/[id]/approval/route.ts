import { isOwner, notOwner } from "@/lib/guard";
import { freshApprovalLink } from "@/lib/street/saga";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isOwner(req, id)) return notOwner();
  try {
    return Response.json({ url: await freshApprovalLink(id) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }
}
