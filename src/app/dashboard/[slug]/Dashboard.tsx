"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact, type CustomCellRendererProps } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type CellValueChangedEvent, type ColDef } from "ag-grid-community";
import { gridTheme } from "@/components/gridTheme";
import { Nav } from "@/components/Brand";
import type { AgentEvent, DemandGap, Order, Product, Shop } from "@/lib/db";

ModuleRegistry.registerModules([AllCommunityModule]);

type State = { can_act: boolean; shop: Shop; products: Product[]; orders: Order[]; events: AgentEvent[]; gaps: DemandGap[] };

const fmt = (cents: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
const ago = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

const STATUS: Record<Order["status"], { label: string; cls: string }> = {
  CREATED: { label: "Awaiting PayPal approval", cls: "bg-paper-2 text-ink-2" },
  PAID: { label: "Paid", cls: "bg-sage-soft text-sage" },
  FULFILLED: { label: "Fulfilled", cls: "bg-[#dde7f1] text-sky" },
  REFUNDED: { label: "Refunded", cls: "bg-[#f6dcd3] text-tomato-ink" },
  PARTIALLY_REFUNDED: { label: "Part refunded", cls: "bg-[#f6dcd3] text-tomato-ink" },
  CANCELLED: { label: "Cancelled", cls: "bg-paper-2 text-ink-3" },
  INVOICED: { label: "Invoice sent", cls: "bg-butter text-ink" },
};

const EVENT_ICON: Record<string, string> = {
  search: "🔎", quote: "🧾", order: "🛒", paid: "💸", invoice: "📨", status: "📦", question: "💬",
  refund_request: "↩️", refund: "↩️", escalation: "🚩", fulfilled: "✅",
};

function AgentBadge({ name }: { name: string }) {
  const n = name.toLowerCase();
  const color = n.includes("claude") ? "#d97757" : n.includes("openai") || n.includes("chatgpt") ? "#10a37f" : n === "merchant" ? "#1d1b17" : "#2f5d8a";
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}

export default function Dashboard({ slug, mcpUrl, isNew, paypalReady }: { slug: string; mcpUrl: string; isNew: boolean; paypalReady: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [copied, setCopied] = useState(false);
  const [modal, setModal] = useState<null | { kind: "fulfill" | "refund"; order: Order }>(null);
  const [toast, setToast] = useState("");
  const [showConnect, setShowConnect] = useState(isNew);
  const seenEvents = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const res = await fetch(`/api/shops/${slug}/state`, { cache: "no-store" });
    if (!res.ok) return;
    const s = (await res.json()) as State;
    const newIds = s.events.filter((e) => !seenEvents.current.has(e.id)).map((e) => e.id);
    if (seenEvents.current.size > 0 && newIds.length) setFresh(new Set(newIds));
    s.events.forEach((e) => seenEvents.current.add(e.id));
    setState(s);
  }, [slug]);

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const orderCols = useMemo<ColDef<Order>[]>(() => [
    { headerName: "When", field: "created_at", width: 105, valueFormatter: (p) => (p.value ? ago(p.value) : ""), sort: "desc" },
    { headerName: "Agent", field: "agent_name", flex: 1.2, minWidth: 170, cellRenderer: (p: CustomCellRendererProps<Order>) => <AgentBadge name={p.value} /> },
    { headerName: "On behalf of", field: "on_behalf_of", flex: 1, minWidth: 120 },
    { headerName: "Items", flex: 2, minWidth: 200, valueGetter: (p) => p.data?.items.map((i) => `${i.quantity}× ${i.name}`).join(", "), tooltipValueGetter: (p) => p.value },
    { headerName: "Total", field: "total_cents", width: 105, type: "rightAligned", valueFormatter: (p) => fmt(p.value), cellClass: "font-mono" },
    {
      headerName: "Status", field: "status", width: 190,
      cellRenderer: (p: CustomCellRendererProps<Order>) => {
        const s = STATUS[p.value as Order["status"]];
        return <span className={`pill ${s.cls}`}>{s.label}{p.data?.refunded_cents ? ` · ${fmt(p.data.refunded_cents)}` : ""}</span>;
      },
    },
    {
      headerName: "", width: 170, sortable: false,
      cellRenderer: (p: CustomCellRendererProps<Order>) => {
        const o = p.data!;
        return (
          <div className="flex h-full items-center gap-1.5">
            {o.status === "PAID" && <button className="btn btn-primary px-3 py-1 text-xs" onClick={() => setModal({ kind: "fulfill", order: o })}>Fulfill</button>}
            {(o.status === "PAID" || o.status === "FULFILLED" || o.status === "PARTIALLY_REFUNDED") && (
              <button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => setModal({ kind: "refund", order: o })}>Refund</button>
            )}
            {o.status === "CREATED" && o.approve_url && <a className="text-xs underline text-ink-3" href={o.approve_url} target="_blank">PayPal link</a>}
          </div>
        );
      },
    },
  ], []);

  const productCols = useMemo<ColDef<Product>[]>(() => [
    { headerName: "Product", field: "name", editable: true, flex: 1.4, minWidth: 180, cellClass: "font-medium" },
    { headerName: "Description", field: "description", editable: true, flex: 2.2, minWidth: 220, tooltipField: "description" },
    {
      headerName: "Price", field: "price_cents", editable: true, width: 100, type: "rightAligned", cellClass: "font-mono",
      valueFormatter: (p) => fmt(p.value),
      valueParser: (p) => Math.round(parseFloat(String(p.newValue).replace(/[^0-9.]/g, "")) * 100) || p.oldValue,
    },
    {
      headerName: "Stock", field: "stock", editable: true, width: 90, type: "rightAligned", cellClass: "font-mono",
      valueParser: (p) => Math.max(0, parseInt(p.newValue, 10) || 0),
      cellStyle: (p) => (p.value <= 2 ? { color: "#b23a1a", fontWeight: 700 } : null),
    },
    { headerName: "Tags", field: "tags", flex: 1.2, minWidth: 150, valueFormatter: (p) => (p.value as string[]).join(", ") },
    {
      headerName: "PayPal catalog", field: "paypal_product_id", width: 170, cellClass: "font-mono text-xs",
      cellRenderer: (p: CustomCellRendererProps<Product>) => (p.value ? <span title="Synced to PayPal Catalog Products API">✓ {p.value}</span> : <span className="text-ink-3">not synced</span>),
    },
    {
      headerName: "Source", field: "source", width: 120,
      cellRenderer: (p: CustomCellRendererProps<Product>) => (p.value === "demand-gap" ? <span className="pill bg-butter">from gap</span> : <span className="text-ink-3">{p.value}</span>),
    },
  ], []);

  const onProductEdit = useCallback(async (e: CellValueChangedEvent<Product>) => {
    if (!e.data || !e.colDef.field) return;
    const res = await fetch(`/api/shops/${slug}/products`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: e.data.id, [e.colDef.field]: e.newValue }),
    });
    flash(res.ok ? `Updated ${e.data.name}` : "View only: this shop belongs to someone else");
    load();
  }, [slug]);

  if (!state) return <div className="grid min-h-screen place-items-center text-ink-3">Opening the shop…</div>;
  const { shop, products, orders, events, gaps } = state;
  const paid = orders.filter((o) => ["PAID", "FULFILLED", "PARTIALLY_REFUNDED"].includes(o.status));
  const revenue = paid.reduce((s, o) => s + o.total_cents - o.refunded_cents, 0);
  const agents = new Set(events.filter((e) => e.agent_name !== "merchant").map((e) => e.agent_name)).size;

  return (
    <>
      <Nav>
        <Link href={`/s/${slug}`} className="btn btn-ghost py-2 text-sm">Storefront</Link>
        <Link href={`/s/${slug}/try`} className="btn btn-accent py-2 text-sm">Shop as an agent →</Link>
      </Nav>
      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {!state.can_act && <div className="mb-4 rounded-xl bg-paper-2 px-4 py-3 text-sm text-ink-2">View only. Add your own shop from a photo to manage one.</div>}
        {!paypalReady && (
          <div className="mb-4 rounded-xl border border-tomato bg-[#fbe7df] px-4 py-3 text-sm">
            PayPal sandbox credentials are not set. Add <code>PAYPAL_CLIENT_ID</code> and <code>PAYPAL_CLIENT_SECRET</code> to <code>.env.local</code> to take payments.
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-sage"><span className="live-dot" /> Live for AI agents</div>
            <h1 className="font-display mt-1 text-5xl sm:text-6xl">{shop.name}</h1>
            <p className="mt-1 text-ink-2">{shop.tagline}</p>
          </div>
          <button className="btn btn-ghost" onClick={() => setShowConnect((x) => !x)}>{showConnect ? "Hide" : "Connect an agent"}</button>
        </div>

        {showConnect && (
          <section className="card mt-6 grid gap-5 p-5 md:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="label">Your shop&apos;s MCP server</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-ink px-3 py-2.5 font-mono text-sm text-paper">{mcpUrl}</code>
                <button className="btn btn-accent py-2" onClick={() => { navigator.clipboard.writeText(mcpUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-3 text-sm text-ink-2">
                Any MCP-capable agent can now browse, quote and order from {shop.name}. Buyers always approve payment on PayPal.
                Also published: <a className="underline" href={`/s/${slug}/feed.json`} target="_blank">product feed</a> ·{" "}
                <a className="underline" href={`/s/${slug}/llms.txt`} target="_blank">llms.txt</a>
              </p>
            </div>
            <ol className="space-y-2 text-sm text-ink-2">
              <li><b className="text-ink">Claude:</b> Settings → Connectors → Add custom connector → paste the URL.</li>
              <li><b className="text-ink">ChatGPT:</b> Settings → Apps → Developer mode → Create app → paste the URL.</li>
              <li><b className="text-ink">No setup:</b> <Link className="underline" href={`/s/${slug}/try`}>try the built-in Claude shopper</Link>.</li>
            </ol>
          </section>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { k: "Revenue (PayPal)", v: fmt(revenue, shop.currency) },
            { k: "Agent orders", v: String(orders.length) },
            { k: "Agents seen", v: String(agents) },
            { k: "Demand gaps", v: String(gaps.length), hot: gaps.length > 0 },
          ].map((m) => (
            <div key={m.k} className={`card p-4 ${m.hot ? "ring-2 ring-butter" : ""}`}>
              <div className="label">{m.k}</div>
              <div className="font-display text-4xl">{m.v}</div>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-display text-3xl">Agent ledger</h2>
                <span className="text-xs text-ink-3">Each order with the agent that placed it, who it was for, and its PayPal status</span>
              </div>
              <AgGridReact<Order>
                theme={gridTheme}
                rowData={orders}
                columnDefs={orderCols}
                getRowId={(p) => p.data.id}
                domLayout="autoHeight"
                animateRows
                tooltipShowDelay={300}
                overlayNoRowsTemplate="No orders yet. Connect an agent, or use “Shop as an agent”."
              />
            </section>

            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-display text-3xl">Shelf</h2>
                <span className="text-xs text-ink-3">Double-click a cell to edit · agents see changes immediately</span>
              </div>
              <AgGridReact<Product>
                theme={gridTheme}
                rowData={products}
                columnDefs={productCols}
                getRowId={(p) => p.data.id}
                domLayout="autoHeight"
                singleClickEdit={false}
                stopEditingWhenCellsLoseFocus
                onCellValueChanged={onProductEdit}
                tooltipShowDelay={300}
              />
            </section>

            <PolicyEditor shop={shop} onSaved={() => { flash("Front-desk policy saved"); load(); }} />
          </div>

          <aside className="grid content-start gap-6 md:grid-cols-2 xl:grid-cols-1">
            <section>
              <h2 className="font-display text-3xl">Demand gaps</h2>
              <p className="text-xs text-ink-3">Things agents asked for that you don&apos;t sell yet</p>
              <div className="mt-3 space-y-3">
                {gaps.length === 0 && <div className="card p-4 text-sm text-ink-3">None yet. When an agent asks for something you don&apos;t sell, it shows up here.</div>}
                {gaps.map((g) => <GapCard key={g.label} gap={g} canAct={state.can_act} slug={slug} currency={shop.currency} onDone={(m) => { flash(m); load(); }} />)}
              </div>
            </section>

            <section>
              <h2 className="font-display text-3xl">Live activity</h2>
              <div className="card mt-3 max-h-[560px] divide-y divide-line overflow-y-auto">
                {events.length === 0 && <div className="p-4 text-sm text-ink-3">Waiting for the first agent…</div>}
                {events.map((e) => (
                  <div key={e.id} className={`flex gap-3 px-4 py-3 text-sm ${fresh.has(e.id) ? "flash" : ""}`}>
                    <span className="text-base">{EVENT_ICON[e.kind] ?? "•"}</span>
                    <div className="min-w-0 flex-1">
                      <div className={e.kind === "escalation" ? "font-semibold text-tomato-ink" : ""}>{e.summary}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
                        <AgentBadge name={e.agent_name} /> · {ago(e.created_at)}
                        {e.gap_label && <span className="pill bg-butter px-1.5 py-0 text-[10px]">gap: {e.gap_label}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>

      {modal && <OrderModal {...modal} slug={slug} shop={shop} onClose={() => setModal(null)} onDone={(m) => { setModal(null); flash(m); load(); }} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm text-paper shadow-lg">{toast}</div>}
    </>
  );
}

function GapCard({ gap, canAct, slug, currency, onDone }: { gap: DemandGap; canAct: boolean; slug: string; currency: string; onDone: (msg: string) => void }) {
  const [draft, setDraft] = useState<null | { name: string; description: string; price_cents: number; tags: string[]; rationale: string }>(null);
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState("");

  async function makeDraft() {
    setBusy(true);
    const res = await fetch(`/api/shops/${slug}/gaps`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: gap.label, action: "draft" }) });
    const json = await res.json();
    setBusy(false);
    if (json.draft) { setDraft(json.draft); setPrice((json.draft.price_cents / 100).toFixed(2)); }
  }
  async function add() {
    if (!draft) return;
    setBusy(true);
    await fetch(`/api/shops/${slug}/products`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, price_cents: Math.round(parseFloat(price) * 100), stock: 10, from_gap: gap.label }),
    });
    onDone(`Added “${draft.name}” to your shelf and PayPal catalog`);
  }
  async function dismiss() {
    await fetch(`/api/shops/${slug}/gaps`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: gap.label, action: "dismiss" }) });
    onDone(`Dismissed “${gap.label}”`);
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold capitalize">{gap.label}</div>
        <span className="tag shrink-0">×{gap.count}</span>
      </div>
      <div className="mt-1 text-xs text-ink-3">{gap.agents} agent{gap.agents === 1 ? "" : "s"} · last {ago(gap.last_seen)}</div>
      <ul className="mt-2 space-y-0.5 text-xs text-ink-2">
        {gap.examples.slice(0, 3).map((ex) => <li key={ex} className="truncate">“{ex}”</li>)}
      </ul>
      {!canAct ? null : !draft ? (
        <div className="mt-3 flex gap-2">
          <button className="btn btn-primary px-3 py-1.5 text-xs" disabled={busy} onClick={makeDraft}>{busy ? "Drafting…" : "✨ Draft product"}</button>
          <button className="btn btn-ghost px-3 py-1.5 text-xs" onClick={dismiss}>Dismiss</button>
        </div>
      ) : (
        <div className="mt-3 rounded-lg bg-paper-2/70 p-3">
          <div className="font-semibold">{draft.name}</div>
          <div className="mt-0.5 text-xs text-ink-2">{draft.description}</div>
          <div className="mt-1 text-[11px] italic text-ink-3">{draft.rationale}</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-ink-3">{currency}</span>
            <input className="input w-20 py-1 font-mono text-sm" value={price} onChange={(e) => setPrice(e.target.value)} />
            <button className="btn btn-accent px-3 py-1.5 text-xs" disabled={busy} onClick={add}>Add to shelf</button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderModal({ kind, order, slug, shop, onClose, onDone }: { kind: "fulfill" | "refund"; order: Order; slug: string; shop: Shop; onClose: () => void; onDone: (m: string) => void }) {
  const [carrier, setCarrier] = useState("USPS");
  const [tracking, setTracking] = useState("");
  const [amount, setAmount] = useState(((order.total_cents - order.refunded_cents) / 100).toFixed(2));
  const [note, setNote] = useState("Sorry about that! Refunded by the shop.");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const shipping = shop.fulfillment === "shipping";

  async function submit() {
    setBusy(true); setErr("");
    const body = kind === "fulfill"
      ? { action: "fulfill", carrier: shipping ? carrier : "", tracking_number: shipping ? tracking : "" }
      : { action: "refund", amount_cents: Math.round(parseFloat(amount) * 100), note };
    const res = await fetch(`/api/shops/${slug}/orders/${order.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(json.error); return; }
    onDone(kind === "fulfill" ? (shipping ? "Tracking sent to PayPal" : "Marked ready for pickup") : `Refunded ${fmt(json.amount_cents)} on PayPal`);
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-3xl">{kind === "fulfill" ? (shipping ? "Ship order" : "Ready for pickup") : "Refund on PayPal"}</h3>
        <p className="mt-1 text-sm text-ink-2">{order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")} · {fmt(order.total_cents)} · for {order.on_behalf_of}</p>
        <div className="mt-4 space-y-3">
          {kind === "fulfill" && shipping && (
            <>
              <div><label className="label">Carrier</label>
                <select className="input" value={carrier} onChange={(e) => setCarrier(e.target.value)}>{["USPS", "UPS", "FEDEX", "DHL", "Local courier"].map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <div><label className="label">Tracking number</label><input className="input font-mono" value={tracking} onChange={(e) => setTracking(e.target.value)} /></div>
              <p className="text-xs text-ink-3">Added to the PayPal transaction with the Shipment Tracking API, so the buyer gets notified and you&apos;re covered by Seller Protection.</p>
            </>
          )}
          {kind === "fulfill" && !shipping && <p className="text-sm text-ink-2">The buyer&apos;s agent will see “ready” the next time it checks the order.</p>}
          {kind === "refund" && (
            <>
              <div><label className="label">Amount (max {fmt(order.total_cents - order.refunded_cents)})</label><input className="input font-mono" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div><label className="label">Note to buyer</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </>
          )}
          {err && <p className="text-sm text-tomato-ink">{err}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || (kind === "fulfill" && shipping && !tracking)} onClick={submit}>{busy ? "Working…" : "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}

function PolicyEditor({ shop, onSaved }: { shop: Shop; onSaved: () => void }) {
  const [policy, setPolicy] = useState(shop.policy);
  const [limit, setLimit] = useState((shop.auto_refund_limit_cents / 100).toFixed(2));
  const dirty = policy !== shop.policy || Math.round(parseFloat(limit) * 100) !== shop.auto_refund_limit_cents;
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-3xl">Front-desk rules</h2>
        <span className="text-xs text-ink-3">Your AI front desk follows these when agents ask questions or request refunds</span>
      </div>
      <textarea className="input mt-3 min-h-28" value={policy} onChange={(e) => setPolicy(e.target.value)} />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div><label className="label">Auto-refund limit ({shop.currency})</label><input className="input w-28 font-mono" value={limit} onChange={(e) => setLimit(e.target.value)} /></div>
        <button className="btn btn-primary" disabled={!dirty} onClick={async () => {
          await fetch(`/api/shops/${shop.slug}/policy`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ policy, auto_refund_limit_cents: Math.round(parseFloat(limit) * 100) }) });
          onSaved();
        }}>Save rules</button>
        <span className="text-xs text-ink-3">Anything above the limit, or outside these rules, is escalated to you.</span>
      </div>
    </section>
  );
}
