import { limited } from "@/lib/guard";
import { ensureDemoShop } from "@/lib/demo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const over = await limited(req, "seed");
  if (over) return over;
  return Response.json(await ensureDemoShop());
}
