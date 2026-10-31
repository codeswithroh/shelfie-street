import { confirmApproval } from "@/lib/street/saga";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await confirmApproval((await params).id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }
}
