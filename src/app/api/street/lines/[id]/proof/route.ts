import { getLine } from "@/lib/street/store";
import { isOwner, limited, notOwner } from "@/lib/guard";
import { submitProof } from "@/lib/street/saga";

export const runtime = "nodejs";
export const maxDuration = 120;

const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type MediaType = (typeof TYPES)[number];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const line = await getLine(id);
  if (!line || !isOwner(req, line.mission_id)) return notOwner();
  const over = await limited(req, "proof");
  if (over) return over;
  const file = (await req.formData()).get("photo");
  if (!(file instanceof File) || !TYPES.includes(file.type as MediaType)) return Response.json({ error: "Upload a JPG, PNG or WebP photo" }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return Response.json({ error: "Photo is over 4 MB" }, { status: 400 });
  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    return Response.json(await submitProof(id, { mediaType: file.type as MediaType, data }));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }
}
