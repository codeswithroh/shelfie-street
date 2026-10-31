import { markCapturedFromWebhook } from "@/lib/commerce";
import { verifyWebhook } from "@/lib/paypal";

export const runtime = "nodejs";

// Backstop for buyers who approve on PayPal but never come back to the return URL.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!(await verifyWebhook(req.headers, raw).catch(() => false))) return new Response("invalid signature", { status: 400 });
  const event = JSON.parse(raw) as {
    event_type: string;
    resource: { id: string; supplementary_data?: { related_ids?: { order_id?: string } } };
  };
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const orderId = event.resource.supplementary_data?.related_ids?.order_id;
    if (orderId) await markCapturedFromWebhook(orderId, event.resource.id);
  }
  return new Response("ok");
}
