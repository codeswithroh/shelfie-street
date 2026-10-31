// Thin PayPal REST client (sandbox by default). Docs: https://developer.paypal.com/api/rest/
import { newId } from "./db";

const BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

export class PayPalError extends Error {
  constructor(message: string, public status: number, public debugId?: string, public details?: unknown) {
    super(message);
  }
}

export const paypalConfigured = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  if (!paypalConfigured()) throw new PayPalError("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set", 500);
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new PayPalError(`PayPal auth failed: ${await res.text()}`, res.status);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function call<T>(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = json?.details?.[0];
    const msg = detail ? `${detail.issue}: ${detail.description}` : json?.message ?? res.statusText;
    throw new PayPalError(`PayPal ${method} ${path} failed (${res.status}) ${msg}`, res.status, json?.debug_id, json?.details);
  }
  return json as T;
}

const amount = (cents: number, currency: string) => ({ currency_code: currency, value: (cents / 100).toFixed(2) });

// ---------- Catalog Products ----------

export async function createCatalogProduct(p: { name: string; description: string; sku: string }) {
  return call<{ id: string }>("POST", "/v1/catalogs/products", {
    id: p.sku,
    name: p.name.slice(0, 127),
    description: (p.description || p.name).slice(0, 256),
    type: "PHYSICAL",
  }, { "PayPal-Request-Id": `prod-${p.sku}` });
}

// ---------- Orders v2 ----------

type LineItem = { name: string; sku: string; quantity: number; unit_cents: number };

type PayPalOrder = {
  id: string;
  status: string;
  links: { href: string; rel: string }[];
  payer?: { name?: { given_name?: string; surname?: string }; email_address?: string };
  purchase_units?: { payments?: { captures?: { id: string; status: string }[] } }[];
};

export async function createOrder(o: {
  shopName: string;
  referenceId: string;
  currency: string;
  items: LineItem[];
  pickup: boolean;
  returnUrl: string;
  cancelUrl: string;
  description: string;
}) {
  const total = o.items.reduce((s, i) => s + i.quantity * i.unit_cents, 0);
  const order = await call<PayPalOrder>("POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: o.referenceId,
        custom_id: o.referenceId,
        description: o.description.slice(0, 127),
        soft_descriptor: o.shopName.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 22) || undefined,
        amount: { ...amount(total, o.currency), breakdown: { item_total: amount(total, o.currency) } },
        items: o.items.map((i) => ({
          name: i.name.slice(0, 127),
          sku: i.sku,
          quantity: String(i.quantity),
          unit_amount: amount(i.unit_cents, o.currency),
          category: "PHYSICAL_GOODS",
        })),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: o.shopName.slice(0, 127),
          user_action: "PAY_NOW",
          shipping_preference: o.pickup ? "NO_SHIPPING" : "GET_FROM_FILE",
          return_url: o.returnUrl,
          cancel_url: o.cancelUrl,
        },
      },
    },
  }, { "PayPal-Request-Id": `order-${o.referenceId}` });
  const approveUrl = order.links.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (!approveUrl) throw new PayPalError("PayPal did not return an approval link", 502);
  return { paypalOrderId: order.id, approveUrl, status: order.status };
}

export async function getPaypalOrder(id: string) {
  return call<PayPalOrder>("GET", `/v2/checkout/orders/${id}`);
}

export async function captureOrder(id: string) {
  const res = await call<PayPalOrder>("POST", `/v2/checkout/orders/${id}/capture`, {}, { "PayPal-Request-Id": `capture-${id}` });
  const capture = res.purchase_units?.[0]?.payments?.captures?.[0];
  const name = [res.payer?.name?.given_name, res.payer?.name?.surname].filter(Boolean).join(" ");
  return { status: res.status, captureId: capture?.id ?? null, payerName: name, payerEmail: res.payer?.email_address ?? "" };
}

// ---------- Refunds ----------

export async function refundCapture(captureId: string, cents: number, currency: string, note: string) {
  return call<{ id: string; status: string }>("POST", `/v2/payments/captures/${captureId}/refund`, {
    amount: amount(cents, currency),
    note_to_payer: note.slice(0, 255),
  }, { "PayPal-Request-Id": `refund-${newId()}` });
}

// ---------- Shipment tracking ----------

export async function addTracking(paypalOrderId: string, captureId: string, carrier: string, trackingNumber: string) {
  const known = ["UPS", "USPS", "FEDEX", "DHL"];
  const c = carrier.toUpperCase();
  return call<{ id: string }>("POST", `/v2/checkout/orders/${paypalOrderId}/track`, {
    capture_id: captureId,
    tracking_number: trackingNumber,
    carrier: known.includes(c) ? c : "OTHER",
    ...(known.includes(c) ? {} : { carrier_name_other: carrier }),
    notify_payer: true,
  });
}

// ---------- Invoicing v2 ----------

export async function createAndSendInvoice(inv: {
  shopName: string;
  currency: string;
  recipientEmail: string;
  recipientName: string;
  items: LineItem[];
  note: string;
  reference: string;
}) {
  const [given, ...rest] = inv.recipientName.trim().split(/\s+/);
  const draft = await call<{ id: string; detail?: { metadata?: { recipient_view_url?: string } } }>("POST", "/v2/invoicing/invoices", {
    detail: {
      currency_code: inv.currency,
      reference: inv.reference,
      note: inv.note.slice(0, 4000),
      payment_term: { term_type: "NET_10" },
    },
    invoicer: { business_name: inv.shopName },
    primary_recipients: [
      {
        billing_info: {
          email_address: inv.recipientEmail,
          name: { given_name: given || "Customer", surname: rest.join(" ") || undefined },
        },
      },
    ],
    items: inv.items.map((i) => ({
      name: i.name.slice(0, 200),
      quantity: String(i.quantity),
      unit_amount: amount(i.unit_cents, inv.currency),
      unit_of_measure: "QUANTITY",
    })),
  });
  await call("POST", `/v2/invoicing/invoices/${draft.id}/send`, { send_to_invoicer: true });
  const full = await call<{ id: string; status: string; detail?: { metadata?: { recipient_view_url?: string } } }>(
    "GET", `/v2/invoicing/invoices/${draft.id}`,
  );
  return { invoiceId: full.id, status: full.status, viewUrl: full.detail?.metadata?.recipient_view_url ?? null };
}

// ---------- Webhooks ----------

export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const res = await call<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: JSON.parse(rawBody),
  });
  return res.verification_status === "SUCCESS";
}
