// Buyer-agent tools. One definition, two consumers: the public per-shop MCP server
// (for Claude, ChatGPT, any MCP client) and the in-app shopper playground.
import { z } from "zod";
import type { Shop } from "./db";
import * as commerce from "./commerce";
import { frontDesk } from "./frontdesk";
import { screenInput } from "./street/firewall";

const cartLine = z.object({
  product_id: z.string().describe("Product id from search_products or list_catalog"),
  quantity: z.number().int().min(1),
});

export type ShopTool = {
  name: string;
  title: string;
  description: string;
  shape: z.ZodRawShape;
  readOnly: boolean;
  run: (shop: Shop, input: Record<string, unknown>, ctx: commerce.AgentCtx) => Promise<unknown> | unknown;
};

export const shopTools: ShopTool[] = [
  {
    name: "get_shop_info",
    title: "Shop info",
    description: "Who this shop is, where it is, how fulfillment and PayPal payment work, and its policies. Call this first.",
    shape: {},
    readOnly: true,
    run: (shop) => commerce.shopInfo(shop),
  },
  {
    name: "search_products",
    title: "Search products",
    description: "Find products matching a buyer's need in natural language (e.g. 'two vegan pastries for a birthday'). Returns only genuine matches, and says what is not available.",
    shape: { query: z.string().describe("What the buyer wants, in their words") },
    readOnly: true,
    run: (shop, i, ctx) => commerce.searchProducts(shop, String(i.query), ctx),
  },
  {
    name: "list_catalog",
    title: "List catalog",
    description: "The full product list with prices and stock.",
    shape: {},
    readOnly: true,
    run: async (shop) => await commerce.listCatalog(shop),
  },
  {
    name: "get_quote",
    title: "Get quote",
    description: "Price a cart before ordering. Returns line totals, the total, stock problems and which PayPal flow will be used.",
    shape: { items: z.array(cartLine).min(1) },
    readOnly: true,
    run: async (shop, i, ctx) => await commerce.quote(shop, i.items as { product_id: string; quantity: number }[], ctx),
  },
  {
    name: "create_order",
    title: "Create order",
    description:
      "Place an order. Returns a PayPal approval link the human buyer must open to pay (the order is confirmed only after they approve). Large orders are invoiced via PayPal instead and need buyer_email. Always confirm the cart and total with the buyer first.",
    shape: {
      items: z.array(cartLine).min(1),
      buyer_name: z.string().describe("Name of the human you are buying for"),
      buyer_email: z.string().optional().describe("Required for invoiced (large) orders"),
      note: z.string().optional().describe("Pickup time, dedication, allergies, etc."),
      on_behalf_of: z.string().optional().describe("Who authorised this purchase, if different from buyer_name"),
    },
    readOnly: false,
    run: (shop, i, ctx) =>
      commerce.placeOrder(
        shop,
        {
          lines: i.items as { product_id: string; quantity: number }[],
          buyer_name: String(i.buyer_name),
          buyer_email: i.buyer_email ? String(i.buyer_email) : undefined,
          note: i.note ? String(i.note) : undefined,
        },
        { ...ctx, onBehalfOf: i.on_behalf_of ? String(i.on_behalf_of) : String(i.buyer_name) },
      ),
  },
  {
    name: "get_order_status",
    title: "Order status",
    description: "Payment and fulfillment status of an order, including tracking when shipped.",
    shape: { order_id: z.string() },
    readOnly: true,
    run: async (shop, i, ctx) => await commerce.orderStatus(shop, String(i.order_id), ctx),
  },
  {
    name: "ask_shop",
    title: "Ask the shop",
    description: "Ask the shop's front desk anything not covered by the catalog (ingredients, custom orders, opening hours).",
    shape: { question: z.string() },
    readOnly: true,
    run: (shop, i, ctx) => frontDesk(shop, { kind: "question", message: String(i.question) }, ctx),
  },
  {
    name: "request_refund",
    title: "Request refund",
    description: "Ask for a full or partial refund on a paid order, with the reason. The shop's front desk decides within the owner's policy and refunds through PayPal, or escalates to the owner.",
    shape: { order_id: z.string(), reason: z.string() },
    readOnly: false,
    run: (shop, i, ctx) => frontDesk(shop, { kind: "refund", message: String(i.reason), orderId: String(i.order_id) }, ctx),
  },
];

// Free text from outside agents that reaches a model or a merchant.
const SCREENED: Record<string, string> = { search_products: "query", ask_shop: "question", request_refund: "reason", create_order: "note" };

export async function runShopTool(tool: ShopTool, shop: Shop, input: Record<string, unknown>, ctx: commerce.AgentCtx) {
  try {
    const field = SCREENED[tool.name];
    if (field && input[field]) {
      const screen = await screenInput(ctx.agentName, shop.id, String(input[field]));
      if (!screen.allowed) return { ok: false, text: `Blocked by the shop's agent firewall (${screen.rule}).` };
    }
    return { ok: true, text: JSON.stringify(await tool.run(shop, input, ctx), null, 2) };
  } catch (e) {
    return { ok: false, text: `Error: ${(e as Error).message}` };
  }
}
