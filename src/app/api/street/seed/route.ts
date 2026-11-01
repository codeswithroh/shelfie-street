import { limited } from "@/lib/guard";
import { ensureDemoStreet } from "@/lib/demo";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const over = await limited(req, "seed");
  if (over) return over;
  await ensureDemoStreet();
  return Response.json({ ok: true });
}
