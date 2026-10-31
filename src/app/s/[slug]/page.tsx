import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Brand";
import { getShop, listProducts, money } from "@/lib/db";
import { appUrl } from "@/lib/commerce";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const shop = await getShop((await params).slug);
  return shop ? { title: `${shop.name} · Shelfie`, description: shop.tagline } : {};
}

export default async function Storefront({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getShop(slug);
  if (!shop) notFound();
  const products = await listProducts(shop.id);
  const mcp = `${appUrl()}/s/${slug}/mcp`;

  // schema.org markup so crawlers and agents can read the catalog without MCP
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: shop.name,
    description: shop.tagline,
    address: shop.location,
    paymentAccepted: "PayPal",
    potentialAction: { "@type": "BuyAction", target: mcp },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      itemListElement: products.map((p) => ({
        "@type": "Offer",
        price: (p.price_cents / 100).toFixed(2),
        priceCurrency: shop.currency,
        availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        itemOffered: { "@type": "Product", name: p.name, description: p.description, sku: p.id },
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Nav>
        <Link href={`/s/${slug}/try`} className="btn btn-accent py-2 text-sm">Shop with an AI agent →</Link>
      </Nav>
      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <span className="pill bg-paper-2 capitalize text-ink-2">{shop.category}</span>
        <h1 className="font-display mt-3 text-6xl">{shop.name}</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-2">{shop.tagline}</p>
        <p className="mt-1 text-sm text-ink-3">{shop.location} · {shop.fulfillment === "pickup" ? "In-store pickup" : "Ships to you"} · Pay with PayPal</p>

        <div className="card mt-8 flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="label">For AI agents</div>
            <code className="block overflow-x-auto whitespace-nowrap font-mono text-sm">{mcp}</code>
          </div>
          <div className="flex gap-2 text-sm">
            <a className="btn btn-ghost py-1.5" href={`/s/${slug}/feed.json`}>feed.json</a>
            <a className="btn btn-ghost py-1.5" href={`/s/${slug}/llms.txt`}>llms.txt</a>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-2xl leading-tight">{p.name}</h3>
                <span className="tag shrink-0">{money(p.price_cents, shop.currency)}</span>
              </div>
              <p className="mt-2 text-sm text-ink-2">{p.description}</p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                {p.tags.map((t) => <span key={t} className="pill bg-paper-2 text-ink-2">{t}</span>)}
                {p.stock <= 2 && <span className="pill bg-[#f6dcd3] text-tomato-ink">{p.stock ? `only ${p.stock} left` : "sold out"}</span>}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
