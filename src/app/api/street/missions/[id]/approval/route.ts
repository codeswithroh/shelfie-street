import { freshApprovalLink } from "@/lib/street/saga";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return Response.json({ url: await freshApprovalLink((await params).id) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }
}
