import Link from "next/link";
import { Nav } from "@/components/Brand";
import { completeCheckout } from "@/lib/commerce";
import { getOrder, getShopById, money, updateOrder, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CheckoutReturn({ searchParams }: { searchParams: Promise<{ order?: string; cancelled?: string }> }) {
  const { order: orderId, cancelled } = await searchParams;
  const existing = orderId ? await getOrder(orderId) : null;
  const shop = existing ? await getShopById(existing.shop_id) : null;
  if (!existing || !shop) {
    return <Shell><h1 className="font-display text-5xl">Order not found</h1></Shell>;
  }

  if (cancelled) {
    if (existing.status === "CREATED") {
      await updateOrder(existing.id, { status: "CANCELLED" });
      await logEvent({ shop_id: shop.id, kind: "order", agent_name: existing.agent_name, order_id: existing.id, summary: "Buyer cancelled on PayPal" });
    }
    return (
      <Shell>
        <h1 className="font-display text-5xl">Payment cancelled</h1>
        <p className="mt-2 text-ink-2">Nothing was charged. You can ask your agent to try again.</p>
      </Shell>
    );
  }

  let error: string | undefined;
  let order = existing;
  try {
    const res = await completeCheckout(existing.id);
    error = res.error;
    order = res.order ?? existing;
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <Shell>
      {error ? (
        <>
          <h1 className="font-display text-5xl">We couldn&apos;t confirm payment</h1>
          <p className="mt-2 text-tomato-ink">{error}</p>
        </>
      ) : (
        <>
          <div className="text-5xl">🧾</div>
          <h1 className="font-display mt-3 text-5xl">Paid. {shop.name} has your order.</h1>
          <p className="mt-2 text-ink-2">Payment captured by PayPal. Your agent can check status any time with order id <code className="font-mono">{order.id}</code>.</p>
          <div className="card mt-6 divide-y divide-line">
            {order.items.map((i) => (
              <div key={i.product_id} className="flex justify-between px-5 py-3">
                <span>{i.quantity}× {i.name}</span>
                <span className="font-mono">{money(i.quantity * i.unit_cents, shop.currency)}</span>
              </div>
            ))}
            <div className="flex justify-between px-5 py-3 font-semibold">
              <span>Total</span><span className="font-mono">{money(order.total_cents, shop.currency)}</span>
            </div>
          </div>
          <p className="mt-4 text-sm text-ink-3">
            {shop.fulfillment === "pickup" ? `Pick up at ${shop.name}, ${shop.location}.` : "You'll get tracking from PayPal when it ships."} Ordered by {order.agent_name} for {order.on_behalf_of}.
          </p>
        </>
      )}
      <div className="mt-8 flex gap-2">
        <Link className="btn btn-ghost" href={`/s/${shop.slug}/try`}>Back to the agent</Link>
        <Link className="btn btn-ghost" href={`/s/${shop.slug}`}>Visit {shop.name}</Link>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6">{children}</main>
    </>
  );
}
