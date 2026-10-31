// Shop operations shared by the MCP server, the in-app shopper playground and the dashboard.
import {
  type Order, type OrderItem, type Product, type Shop,
  createOrderRow, decrementStock, getShopById, getOrder, getOrderByPaypalId, getProduct, listProducts,
  logEvent, money, setEventGap, updateOrder,
} from "./db";
import { matchCatalog } from "./ai";
import * as paypal from "./paypal";

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Orders at or above this total go out as a PayPal invoice (NET 10) instead of instant checkout.
export const INVOICE_THRESHOLD_CENTS = Number(process.env.INVOICE_THRESHOLD_CENTS ?? 25000);

export type AgentCtx = { agentName: string; onBehalfOf?: string };

const publicProduct = (p: Product, currency: string) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  price: money(p.price_cents, currency),
  price_cents: p.price_cents,
  in_stock: p.stock,
  tags: p.tags,
});

export function shopInfo(shop: Shop) {
  return {
    name: shop.name,
    category: shop.category,
    about: shop.tagline,
    location: shop.location,
    fulfillment: shop.fulfillment === "pickup" ? "In-store pickup" : "Shipping",
    currency: shop.currency,
    payments: "PayPal (the buyer approves every payment on paypal.com; Pay Later where eligible). Orders over " +
      money(INVOICE_THRESHOLD_CENTS, shop.currency) + " are invoiced through PayPal.",
    policies: shop.policy,
  };
}

export async function searchProducts(shop: Shop, query: string, ctx: AgentCtx) {
  const products = (await listProducts(shop.id)).filter((p) => p.stock > 0);
  const ev = await logEvent({ shop_id: shop.id, kind: "search", agent_name: ctx.agentName, summary: `Searched “${query}”`, query });
  const match = await matchCatalog(shop, products, query);
  const found = match.product_ids.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[];
  await setEventGap(ev.id, match.unmet_need.trim().toLowerCase() || null);
  return {
    results: found.map((p) => publicProduct(p, shop.currency)),
    note: match.explanation,
    ...(match.unmet_need ? { not_available: match.unmet_need } : {}),
  };
}

export async function listCatalog(shop: Shop) {
  return (await listProducts(shop.id)).map((p) => publicProduct(p, shop.currency));
}

type CartLine = { product_id: string; quantity: number };

export async function priceCart(shop: Shop, lines: CartLine[]) {
  const items: OrderItem[] = [];
  const problems: string[] = [];
  for (const l of lines) {
    const p = await getProduct(l.product_id);
    if (!p || p.shop_id !== shop.id) { problems.push(`Unknown product ${l.product_id}`); continue; }
    if (l.quantity < 1) { problems.push(`Quantity for ${p.name} must be at least 1`); continue; }
    if (p.stock < l.quantity) problems.push(`Only ${p.stock} × ${p.name} in stock`);
    items.push({ product_id: p.id, name: p.name, quantity: l.quantity, unit_cents: p.price_cents });
  }
  const total = items.reduce((s, i) => s + i.quantity * i.unit_cents, 0);
  return { items, total, problems };
}

export async function quote(shop: Shop, lines: CartLine[], ctx: AgentCtx) {
  const { items, total, problems } = await priceCart(shop, lines);
  if (items.length) await logEvent({ shop_id: shop.id, kind: "quote", agent_name: ctx.agentName, summary: `Quoted ${items.map((i) => `${i.quantity}× ${i.name}`).join(", ")} = ${money(total, shop.currency)}` });
  return {
    lines: items.map((i) => ({ ...i, line_total: money(i.quantity * i.unit_cents, shop.currency) })),
    total: money(total, shop.currency),
    checkout: total >= INVOICE_THRESHOLD_CENTS ? "PayPal invoice (NET 10) — buyer email required" : "PayPal checkout link for the buyer to approve",
    problems,
  };
}

export async function placeOrder(
  shop: Shop,
  input: { lines: CartLine[]; buyer_name: string; buyer_email?: string; note?: string },
  ctx: AgentCtx,
) {
  const { items, total, problems } = await priceCart(shop, input.lines);
  if (problems.length || !items.length) return { ok: false as const, problems: problems.length ? problems : ["Cart is empty"] };

  const base = {
    shop_id: shop.id,
    items,
    total_cents: total,
    buyer_name: input.buyer_name,
    buyer_email: input.buyer_email ?? "",
    agent_name: ctx.agentName,
    on_behalf_of: ctx.onBehalfOf ?? input.buyer_name,
    note: input.note ?? "",
  };
  const lineItems = items.map((i) => ({ name: i.name, sku: i.product_id, quantity: i.quantity, unit_cents: i.unit_cents }));

  // Large orders: PayPal invoice
  if (total >= INVOICE_THRESHOLD_CENTS) {
    if (!input.buyer_email) return { ok: false as const, problems: ["Orders this size are invoiced — please provide buyer_email"] };
    const order = await createOrderRow({ ...base, paypal_order_id: null, status: "INVOICED", approve_url: null });
    const inv = await paypal.createAndSendInvoice({
      shopName: shop.name, currency: shop.currency, recipientEmail: input.buyer_email, recipientName: input.buyer_name,
      items: lineItems, reference: order.id,
      note: `Ordered via ${ctx.agentName} on behalf of ${base.on_behalf_of}. ${input.note ?? ""}`,
    });
    await updateOrder(order.id, { invoice_id: inv.invoiceId, approve_url: inv.viewUrl });
    await logEvent({ shop_id: shop.id, kind: "invoice", agent_name: ctx.agentName, order_id: order.id, summary: `Invoiced ${money(total, shop.currency)} to ${input.buyer_email}` });
    return {
      ok: true as const,
      order_id: order.id,
      total: money(total, shop.currency),
      payment: "A PayPal invoice was emailed to the buyer (NET 10).",
      invoice_url: inv.viewUrl,
    };
  }

  // Normal orders: PayPal Orders v2, buyer approves on PayPal
  const order = await createOrderRow({ ...base, paypal_order_id: null, status: "CREATED", approve_url: null });
  const pp = await paypal.createOrder({
    shopName: shop.name,
    referenceId: order.id,
    currency: shop.currency,
    items: lineItems,
    pickup: shop.fulfillment === "pickup",
    returnUrl: `${appUrl()}/checkout/return?order=${order.id}`,
    cancelUrl: `${appUrl()}/checkout/return?order=${order.id}&cancelled=1`,
    description: `${shop.name} order ${order.id}`,
  });
  await updateOrder(order.id, { paypal_order_id: pp.paypalOrderId, approve_url: pp.approveUrl });
  await logEvent({ shop_id: shop.id, kind: "order", agent_name: ctx.agentName, order_id: order.id, summary: `Created PayPal order ${money(total, shop.currency)} for ${base.on_behalf_of}` });
  return {
    ok: true as const,
    order_id: order.id,
    total: money(total, shop.currency),
    payment: "Give this PayPal link to the buyer. The order is confirmed once they approve it.",
    approve_url: pp.approveUrl,
  };
}

/** Called when the buyer returns from PayPal (and by the webhook as a backstop). Idempotent. */
export async function completeCheckout(orderId: string) {
  const order = await getOrder(orderId);
  if (!order?.paypal_order_id) return { order, error: "Order not found" };
  if (order.status !== "CREATED") return { order };
  const cap = await paypal.captureOrder(order.paypal_order_id);
  if (cap.status !== "COMPLETED") return { order, error: `PayPal status ${cap.status}` };
  const updated = await updateOrder(order.id, {
    status: "PAID", capture_id: cap.captureId,
    buyer_name: order.buyer_name || cap.payerName, buyer_email: order.buyer_email || cap.payerEmail,
  })!;
  await decrementStock(order.items);
  await logEvent({ shop_id: order.shop_id, kind: "paid", agent_name: order.agent_name, order_id: order.id, summary: `Payment captured · ${money(order.total_cents)}` });
  return { order: updated };
}

export async function markCapturedFromWebhook(paypalOrderId: string, captureId: string) {
  const order = await getOrderByPaypalId(paypalOrderId);
  if (!order || order.status !== "CREATED") return;
  await updateOrder(order.id, { status: "PAID", capture_id: captureId });
  await decrementStock(order.items);
  await logEvent({ shop_id: order.shop_id, kind: "paid", agent_name: order.agent_name, order_id: order.id, summary: `Payment captured (webhook) · ${money(order.total_cents)}` });
}

export async function orderStatus(shop: Shop, orderId: string, ctx: AgentCtx) {
  const o = await getOrder(orderId);
  if (!o || o.shop_id !== shop.id) return { error: "No such order at this shop" };
  await logEvent({ shop_id: shop.id, kind: "status", agent_name: ctx.agentName, order_id: o.id, summary: `Checked status of order ${o.id}` });
  return publicOrder(o, shop);
}

export function publicOrder(o: Order, shop: Shop) {
  const statusText: Record<Order["status"], string> = {
    CREATED: "Awaiting buyer approval on PayPal",
    PAID: shop.fulfillment === "pickup" ? "Paid — being prepared for pickup" : "Paid — being prepared for shipping",
    FULFILLED: shop.fulfillment === "pickup" ? "Ready / picked up" : "Shipped",
    REFUNDED: "Refunded in full",
    PARTIALLY_REFUNDED: "Partially refunded",
    CANCELLED: "Cancelled",
    INVOICED: "Invoice sent — awaiting payment",
  };
  return {
    order_id: o.id,
    status: statusText[o.status],
    items: o.items.map((i) => `${i.quantity}× ${i.name}`),
    total: money(o.total_cents, shop.currency),
    refunded: o.refunded_cents ? money(o.refunded_cents, shop.currency) : undefined,
    tracking: o.tracking ?? undefined,
    approve_url: o.status === "CREATED" ? o.approve_url : undefined,
    placed_at: o.created_at,
  };
}

export async function fulfillOrder(order: Order, carrier: string, trackingNumber: string) {
  if (!order.capture_id || !order.paypal_order_id) throw new Error("Order has not been paid yet");
  if (trackingNumber) await paypal.addTracking(order.paypal_order_id, order.capture_id, carrier, trackingNumber);
  const updated = await updateOrder(order.id, { status: "FULFILLED", tracking: trackingNumber ? { carrier, number: trackingNumber } : null })!;
  await logEvent({
    shop_id: order.shop_id, kind: "fulfilled", agent_name: "merchant", order_id: order.id,
    summary: trackingNumber ? `Shipped via ${carrier} · ${trackingNumber} (tracking sent to PayPal)` : "Marked ready for pickup",
  });
  return updated;
}

export async function refund(order: Order, cents: number, note: string, actor: string) {
  if (!order.capture_id) throw new Error("Order has no captured payment to refund");
  const refundable = order.total_cents - order.refunded_cents;
  const amt = Math.min(cents, refundable);
  if (amt <= 0) throw new Error("Nothing left to refund");
  const currency = (await getShopById(order.shop_id))?.currency ?? "USD";
  const r = await paypal.refundCapture(order.capture_id, amt, currency, note);
  const refunded = order.refunded_cents + amt;
  const updated = await updateOrder(order.id, { refunded_cents: refunded, status: refunded >= order.total_cents ? "REFUNDED" : "PARTIALLY_REFUNDED" })!;
  await logEvent({ shop_id: order.shop_id, kind: "refund", agent_name: actor, order_id: order.id, summary: `Refunded ${money(amt, currency)} on PayPal (${r.status}) — ${note}` });
  return { refund_id: r.id, status: r.status, amount_cents: amt, order: updated };
}
