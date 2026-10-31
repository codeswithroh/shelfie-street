import { z } from "zod";
import { planMission } from "@/lib/street/saga";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({ goal: z.string().min(5).max(500), buyer: z.string().min(1).max(60), budget_cents: z.number().int().min(500).max(100000) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Add a goal and a budget between $5 and $1,000" }, { status: 400 });
  try {
    const m = await planMission(body.data.goal, body.data.buyer, body.data.budget_cents);
    return Response.json({ id: m.id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }
}
