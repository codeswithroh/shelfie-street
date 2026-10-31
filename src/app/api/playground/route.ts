// "Try it as an AI shopper": Claude acts as a buyer's personal shopping agent and uses
// the exact same tools the public MCP server exposes.
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { FALLBACK, MODEL, claude } from "@/lib/ai";
import { getShop } from "@/lib/db";
import { runShopTool, shopTools } from "@/lib/tools";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  slug: z.string(),
  buyer: z.string().default("Alex"),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1),
});

export type PlaygroundStep = { tool: string; input: unknown; output: string; ok: boolean };

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const shop = await getShop(body.data.slug);
  if (!shop) return Response.json({ error: "Unknown shop" }, { status: 404 });

  const steps: PlaygroundStep[] = [];
  const ctx = { agentName: "Claude shopping agent (playground)", onBehalfOf: body.data.buyer };
  const tools = shopTools.map((t) =>
    betaZodTool({
      name: t.name,
      description: t.description,
      inputSchema: z.object(t.shape),
      run: async (input) => {
        const res = await runShopTool(t, shop, input as Record<string, unknown>, ctx);
        steps.push({ tool: t.name, input, output: res.text, ok: res.ok });
        return res.text;
      },
    }),
  );

  try {
    const final = await claude().beta.messages.toolRunner({
      ...FALLBACK,
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low" },
      system:
        `You are ${body.data.buyer}'s personal AI shopping agent, connected to ${shop.name} through its Shelfie MCP tools. ` +
        "Find what they ask for, check prices with get_quote, and only call create_order after they have clearly said yes to the exact cart and total (a request phrased as a direct order, like 'order two loaves', counts as a yes). " +
        "When you create an order, give them the PayPal link verbatim and say payment is confirmed only after they approve it on PayPal. " +
        "If the shop can't meet a need, say so plainly. Be brief: 1-4 short sentences, no markdown headings.",
      tools,
      max_iterations: 10,
      messages: body.data.messages,
    });
    const reply = final.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return Response.json({ reply: reply || "(no reply)", steps });
  } catch (e) {
    return Response.json({ error: (e as Error).message, steps }, { status: 500 });
  }
}
