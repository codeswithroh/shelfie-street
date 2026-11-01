// The merchant's AI front desk: answers buyer agents and resolves refund requests
// inside the policy the merchant wrote, using real PayPal refunds.
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { FALLBACK, MODEL, claude } from "./ai";
import { type Shop, getOrder, listProducts, logEvent, money } from "./db";
import { publicOrder, refund, type AgentCtx } from "./commerce";

export type FrontDeskResult = { reply: string; actions: string[]; escalated: boolean };

export async function frontDesk(
  shop: Shop,
  request: { kind: "question" | "refund"; message: string; orderId?: string },
  ctx: AgentCtx,
): Promise<FrontDeskResult> {
  const actions: string[] = [];
  let escalated = false;

  const lookupOrder = betaZodTool({
    name: "lookup_order",
    description: "Look up an order at this shop by id: items, total, payment status, refunds so far.",
    inputSchema: z.object({ order_id: z.string() }),
    run: async ({ order_id }) => {
      const o = await getOrder(order_id);
      if (!o || o.shop_id !== shop.id) return "No such order.";
      return JSON.stringify({ ...publicOrder(o, shop), refundable: money(o.total_cents - o.refunded_cents, shop.currency), paid: !!o.capture_id });
    },
  });

  const issueRefund = betaZodTool({
    name: "issue_refund",
    description: `Refund part or all of a paid order through PayPal. You may only refund up to ${money(shop.auto_refund_limit_cents, shop.currency)} in total per order on your own authority; anything larger must be escalated.`,
    inputSchema: z.object({
      order_id: z.string(),
      amount_cents: z.number().int().positive(),
      note_to_buyer: z.string().describe("Short, kind note shown to the buyer on PayPal"),
    }),
    run: async ({ order_id, amount_cents, note_to_buyer }) => {
      const o = await getOrder(order_id);
      if (!o || o.shop_id !== shop.id) return "No such order.";
      if (o.refunded_cents + amount_cents > shop.auto_refund_limit_cents) return `Refused: above your ${money(shop.auto_refund_limit_cents, shop.currency)} limit. Escalate instead.`;
      try {
        const r = await refund(o, amount_cents, note_to_buyer, "Shelfie front desk");
        actions.push(`Refunded ${money(r.amount_cents, shop.currency)} on PayPal (refund ${r.refund_id})`);
        return `Refund ${r.refund_id} ${r.status} for ${money(r.amount_cents, shop.currency)}.`;
      } catch (e) {
        return `Refund failed: ${(e as Error).message}`;
      }
    },
  });

  const escalate = betaZodTool({
    name: "escalate_to_merchant",
    description: "Hand the case to the shop owner when it is outside policy, over your refund limit, or you are unsure.",
    inputSchema: z.object({ summary: z.string(), recommended_action: z.string() }),
    run: async ({ summary, recommended_action }) => {
      escalated = true;
      await logEvent({ shop_id: shop.id, kind: "escalation", agent_name: ctx.agentName, order_id: request.orderId ?? null, summary: `Needs you: ${summary} → suggested: ${recommended_action}` });
      actions.push("Escalated to the shop owner");
      return "Escalated. The owner will follow up with the buyer.";
    },
  });

  const catalog = (await listProducts(shop.id))
    .map((p) => `- ${p.name} (${money(p.price_cents, shop.currency)}, ${p.stock} left): ${p.description}`)
    .join("\n");

  const system = `You are the front desk of ${shop.name}, a ${shop.category} in ${shop.location || "town"}. You are talking to another AI agent that represents a buyer (${ctx.onBehalfOf || "a customer"}), not to a human.

Shop policy written by the owner (follow it exactly):
${shop.policy || "No written policy. Be fair; escalate anything unusual."}

Your refund authority: up to ${money(shop.auto_refund_limit_cents, shop.currency)} per order. Verify the order with lookup_order before refunding. Never refund an unpaid order. When the policy does not clearly cover the case, escalate.

Catalog:
${catalog}

Reply to the agent in 1-3 plain sentences stating the outcome.`;

  const userMsg = request.kind === "refund"
    ? `Refund request for order ${request.orderId ?? "(no order id given)"}: ${request.message}`
    : request.message;

  const final = await claude().beta.messages.toolRunner({
    ...FALLBACK,
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "low" },
    system,
    tools: [lookupOrder, issueRefund, escalate],
    max_iterations: 6,
    messages: [{ role: "user", content: userMsg }],
  });

  const reply = final.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim() ||
    (final.stop_reason === "refusal" ? "I can't help with that request." : "Done.");

  await logEvent({
    shop_id: shop.id,
    kind: request.kind === "refund" ? "refund_request" : "question",
    agent_name: ctx.agentName,
    order_id: request.orderId ?? null,
    summary: `${request.kind === "refund" ? "Refund request" : "Asked"}: “${request.message.slice(0, 120)}” → ${actions.join("; ") || reply.slice(0, 140)}`,
    query: request.kind === "question" ? request.message : null,
  });

  return { reply, actions, escalated };
}
