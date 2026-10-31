"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Nav } from "@/components/Brand";

type Draft = { name: string; description: string; price: string; stock: number; tags: string; price_visible: boolean };

const READING = ["Reading price tags…", "Counting what's on the shelf…", "Writing descriptions agents can match…", "Tagging vegan, gluten-free, nut-free…"];

const DEFAULT_POLICY =
  "Pickup during opening hours. If an item is missing or damaged, refund that item in full. Change-of-mind after pickup: no refund. Escalate anything unusual to the owner.";

export default function Onboard() {
  const router = useRouter();
  const [stage, setStage] = useState<"capture" | "reading" | "review" | "publishing">("capture");
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [notes, setNotes] = useState("");
  const [shop, setShop] = useState({
    name: "", tagline: "", category: "", location: "", fulfillment: "pickup" as "pickup" | "shipping",
    currency: "USD", policy: DEFAULT_POLICY, refundLimit: "15",
  });
  const [items, setItems] = useState<Draft[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage !== "reading") return;
    const t = setInterval(() => setTick((x) => x + 1), 1800);
    return () => clearInterval(t);
  }, [stage]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  async function read() {
    setError("");
    setStage("reading");
    const fd = new FormData();
    files.forEach((f) => fd.append("photos", f));
    fd.append("text", text);
    fd.append("currency", shop.currency);
    const res = await fetch("/api/onboard/extract", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Something went wrong"); setStage("capture"); return; }
    setShop((s) => ({ ...s, name: s.name || json.shop.suggested_name, category: json.shop.category, tagline: json.shop.tagline }));
    setItems(json.products.map((p: { name: string; description: string; price_cents: number; stock_estimate: number; tags: string[]; price_visible: boolean }) => ({
      name: p.name, description: p.description, price: (p.price_cents / 100).toFixed(2),
      stock: p.stock_estimate || 10, tags: p.tags.join(", "), price_visible: p.price_visible,
    })));
    setNotes(json.notes);
    setStage("review");
  }

  async function publish() {
    setError("");
    if (!shop.name.trim()) { setError("Give your shop a name"); return; }
    const products = items
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(), description: i.description, price_cents: Math.round(parseFloat(i.price || "0") * 100),
        stock: Number(i.stock) || 0, tags: i.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      }));
    if (products.some((p) => !(p.price_cents > 0))) { setError("Every product needs a price"); return; }
    setStage("publishing");
    const res = await fetch("/api/onboard/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shop: {
          name: shop.name, tagline: shop.tagline, category: shop.category, location: shop.location, fulfillment: shop.fulfillment,
          currency: shop.currency, policy: shop.policy, auto_refund_limit_cents: Math.round(parseFloat(shop.refundLimit || "0") * 100),
        },
        products,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Could not publish"); setStage("review"); return; }
    router.push(`/dashboard/${json.slug}?new=1`);
  }

  const update = (i: number, patch: Partial<Draft>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        {(stage === "capture" || stage === "reading") && (
          <section className="pt-6">
            <h1 className="font-display text-5xl sm:text-6xl">Show us your shelf.</h1>
            <p className="mt-3 max-w-xl text-ink-2">Upload one or more photos of your shelves, counter, menu board or price list. You can also paste a menu, or use both.</p>

            <div
              className="card relative mt-8 grid min-h-64 cursor-pointer place-items-center overflow-hidden border-dashed p-6"
              onClick={() => stage === "capture" && inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); setFiles((f) => [...f, ...Array.from(e.dataTransfer.files).filter((x) => x.type.startsWith("image/"))]); }}
            >
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple hidden
                onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])} />
              {files.length === 0 ? (
                <div className="text-center">
                  <div className="text-5xl">📸</div>
                  <div className="mt-3 font-semibold">Tap to take a photo or drop images here</div>
                  <div className="text-sm text-ink-3">JPG, PNG or WebP, up to 5 MB each</div>
                </div>
              ) : (
                <div className="flex w-full flex-wrap justify-center gap-3">
                  {previews.map((src, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-44 w-auto rounded-lg object-cover shadow" />
                      {stage === "capture" && (
                        <button className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-ink text-xs text-paper"
                          onClick={(e) => { e.stopPropagation(); setFiles((f) => f.filter((_, j) => j !== i)); }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {stage === "reading" && <div className="scanline" />}
            </div>

            <div className="mt-4">
              <label className="label">Or paste a menu / notes (optional)</label>
              <textarea className="input min-h-24" placeholder="e.g. Sourdough $9, seeded rye $10, croissants $4.75 — everything is baked fresh daily, rye is vegan"
                value={text} onChange={(e) => setText(e.target.value)} disabled={stage === "reading"} />
            </div>
            {error && <p className="mt-3 text-sm text-tomato-ink">{error}</p>}
            <div className="mt-6 flex items-center gap-4">
              <button className="btn btn-accent text-base" disabled={stage === "reading" || (!files.length && !text.trim())} onClick={read}>
                {stage === "reading" ? READING[tick % READING.length] : "Read my shelf →"}
              </button>
              <span className="text-sm text-ink-3">Claude vision builds your catalog. You review everything before it goes live.</span>
            </div>
          </section>
        )}

        {(stage === "review" || stage === "publishing") && (
          <section className="pt-6">
            <h1 className="font-display text-5xl">Here&apos;s your shop.</h1>
            <p className="mt-2 text-ink-2">Claude found <b>{items.length}</b> products. Fix anything that looks wrong, then go live.</p>
            {notes && <p className="mt-3 rounded-lg bg-butter/50 px-4 py-2 text-sm">📝 {notes}</p>}

            <div className="card mt-6 grid gap-4 p-5 sm:grid-cols-2">
              <div><label className="label">Shop name</label><input className="input" value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} placeholder="Crumb & Co." /></div>
              <div><label className="label">Category</label><input className="input" value={shop.category} onChange={(e) => setShop({ ...shop, category: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="label">Tagline</label><input className="input" value={shop.tagline} onChange={(e) => setShop({ ...shop, tagline: e.target.value })} /></div>
              <div><label className="label">Neighbourhood / city</label><input className="input" value={shop.location} onChange={(e) => setShop({ ...shop, location: e.target.value })} placeholder="Mission District, San Francisco" /></div>
              <div>
                <label className="label">Fulfillment</label>
                <select className="input" value={shop.fulfillment} onChange={(e) => setShop({ ...shop, fulfillment: e.target.value as "pickup" | "shipping" })}>
                  <option value="pickup">In-store pickup</option>
                  <option value="shipping">Shipping</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Policy for your AI front desk (plain English)</label>
                <textarea className="input min-h-20" value={shop.policy} onChange={(e) => setShop({ ...shop, policy: e.target.value })} />
              </div>
              <div>
                <label className="label">Front desk may refund up to ($)</label>
                <input className="input" inputMode="decimal" value={shop.refundLimit} onChange={(e) => setShop({ ...shop, refundLimit: e.target.value })} />
              </div>
            </div>

            <div className="card mt-6 overflow-hidden">
              <div className="hidden grid-cols-[1.3fr_2fr_90px_70px_1.2fr_32px] gap-3 border-b border-line bg-paper-2/60 px-4 py-2 sm:grid">
                {["Product", "Description", "Price", "Stock", "Tags", ""].map((h) => <div key={h} className="label mb-0">{h}</div>)}
              </div>
              {items.map((it, i) => (
                <div key={i} className="grid gap-2 border-b border-line px-4 py-3 last:border-0 sm:grid-cols-[1.3fr_2fr_90px_70px_1.2fr_32px] sm:gap-3">
                  <input className="input font-semibold" value={it.name} onChange={(e) => update(i, { name: e.target.value })} />
                  <input className="input" value={it.description} onChange={(e) => update(i, { description: e.target.value })} />
                  <div className="relative">
                    <input className={`input font-mono ${it.price_visible ? "" : "border-tomato"}`} inputMode="decimal" value={it.price} onChange={(e) => update(i, { price: e.target.value, price_visible: true })} />
                    {!it.price_visible && <span className="absolute -bottom-4 left-1 text-[10px] text-tomato-ink">estimated</span>}
                  </div>
                  <input className="input font-mono" inputMode="numeric" value={it.stock} onChange={(e) => update(i, { stock: Number(e.target.value) || 0 })} />
                  <input className="input text-sm" value={it.tags} onChange={(e) => update(i, { tags: e.target.value })} />
                  <button className="text-ink-3 hover:text-tomato" title="Remove" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button className="w-full px-4 py-3 text-left text-sm font-semibold text-ink-2 hover:bg-paper-2/60"
                onClick={() => setItems((xs) => [...xs, { name: "", description: "", price: "", stock: 10, tags: "", price_visible: true }])}>
                + Add a product
              </button>
            </div>

            {error && <p className="mt-3 text-sm text-tomato-ink">{error}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button className="btn btn-accent text-base" disabled={stage === "publishing"} onClick={publish}>
                {stage === "publishing" ? "Creating PayPal catalog & MCP server…" : "Go live for AI agents →"}
              </button>
              <button className="btn btn-ghost" onClick={() => setStage("capture")} disabled={stage === "publishing"}>← Back to photos</button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
