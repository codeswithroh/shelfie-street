import { ensureDemoStreet } from "@/lib/demo";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  await ensureDemoStreet();
  return Response.json({ ok: true });
}
