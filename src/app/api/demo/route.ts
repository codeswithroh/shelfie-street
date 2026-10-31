import { ensureDemoShop } from "@/lib/demo";

export const runtime = "nodejs";

export async function POST() {
  return Response.json(await ensureDemoShop());
}
