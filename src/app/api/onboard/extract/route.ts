import { extractCatalog } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 120;

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaType = (typeof TYPES)[number];

export async function POST(req: Request) {
  const form = await req.formData();
  const text = String(form.get("text") ?? "");
  const currency = String(form.get("currency") ?? "USD");
  const images: { mediaType: MediaType; data: string }[] = [];
  for (const f of form.getAll("photos")) {
    if (!(f instanceof File) || !f.size) continue;
    if (!TYPES.includes(f.type as MediaType)) return Response.json({ error: `Unsupported image type ${f.type}` }, { status: 400 });
    if (f.size > 5 * 1024 * 1024) return Response.json({ error: `${f.name} is over 5 MB` }, { status: 400 });
    images.push({ mediaType: f.type as MediaType, data: Buffer.from(await f.arrayBuffer()).toString("base64") });
  }
  if (!images.length && !text.trim()) return Response.json({ error: "Add a photo or describe what you sell" }, { status: 400 });
  try {
    return Response.json(await extractCatalog(images, text, currency));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
