import Link from "next/link";
import { Nav } from "@/components/Brand";
import { DemoButton } from "@/components/DemoButton";
import { listShops, listProducts } from "@/lib/db";

export const dynamic = "force-dynamic";

const steps = [
  { n: "01", title: "Snap your shelf", body: "Photograph your shelf, counter, menu board or price list. Claude reads every item, price and attribute." },
  { n: "02", title: "Go live for agents", body: "Your catalog lands in PayPal and gets its own MCP server, product feed and llms.txt. Claude, ChatGPT and other agents can find it." },
  { n: "03", title: "Get paid on PayPal", body: "Agents quote and order; buyers approve on PayPal. A front-desk agent handles status checks and refunds under your rules." },
];

export default async function Home() {
  const shops = await Promise.all((await listShops()).map(async (s) => ({ ...s, itemCount: (await listProducts(s.id)).length })));
  return (
    <>
      <Nav>
        <Link href="/onboard" className="btn btn-primary">Create a shop</Link>
      </Nav>
      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <section className="grid items-center gap-10 pt-10 lg:grid-cols-[1.15fr_1fr] lg:pt-16">
          <div>
            <span className="pill bg-sage-soft text-sage">
              <span className="live-dot" /> Built on PayPal + Claude
            </span>
            <h1 className="font-display mt-5 text-5xl leading-[1.02] sm:text-7xl">
              Snap your shelf.<br />
              <span className="text-tomato">Sell to AI agents</span> by lunch.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-2">
              People are starting to shop through AI assistants, but the bakery down the street has no API, no product feed and no
              checkout an agent can use. Shelfie gives any small shop all three from one photo, with PayPal handling payment.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/onboard" className="btn btn-accent text-base">📸 Snap my shelf</Link>
              <DemoButton />
            </div>
          </div>

          <div className="card relative overflow-hidden p-5">
            <div className="label">What an agent sees</div>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-ink p-4 font-mono text-[12.5px] leading-relaxed text-paper">
{`> search_products("2 vegan loaves for Saturday")
✓ Country Sourdough Loaf   $9.00  vegan
✓ Seeded Rye              $10.00  vegan

> create_order(2 × Country Sourdough)
→ approve on PayPal:
  https://www.sandbox.paypal.com/checkoutnow?…

> search_products("gluten-free bread")
✗ not_available: "gluten-free bread"
  ↳ logged as demand gap for the owner`}
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="tag">$9.00 sourdough</span>
              <span className="tag">$4.75 croissant</span>
              <span className="tag">$5.00 cardamom bun</span>
            </div>
          </div>
        </section>

        <section className="mt-24 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="card p-6">
              <div className="font-mono text-sm text-tomato">{s.n}</div>
              <h3 className="font-display mt-2 text-3xl">{s.title}</h3>
              <p className="mt-2 text-ink-2">{s.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 card grid gap-6 p-6 md:grid-cols-[1fr_2fr] md:p-8">
          <div>
            <div className="label">The standout feature</div>
            <h2 className="font-display text-4xl">Demand gaps</h2>
          </div>
          <p className="text-lg text-ink-2">
            Every time an agent asks for something you don&apos;t sell, Shelfie records it. <em>“Agents asked for gluten-free bread 14 times this
            week.”</em> One click drafts the product with Claude and puts it in your PayPal catalog. You find out what AI shoppers want before
            you lose the sale.
          </p>
        </section>

        {shops.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-4xl">Live shops</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shops.map((s) => (
                <div key={s.id} className="card flex flex-col p-5">
                  <div className="flex items-center justify-between">
                    <span className="pill bg-paper-2 text-ink-2 capitalize">{s.category || "shop"}</span>
                    <span className="font-mono text-xs text-ink-3">{s.itemCount} items</span>
                  </div>
                  <h3 className="font-display mt-3 text-3xl">{s.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-2">{s.tagline}</p>
                  <div className="mt-auto flex gap-2 pt-5">
                    <Link className="btn btn-primary py-2 text-sm" href={`/dashboard/${s.slug}`}>Dashboard</Link>
                    <Link className="btn btn-ghost py-2 text-sm" href={`/s/${s.slug}/try`}>Shop as an agent</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-sm text-ink-3 sm:px-6">
        Shelfie · PayPal sandbox · Claude · Built for the PayPal AI Hackathon
      </footer>
    </>
  );
}
