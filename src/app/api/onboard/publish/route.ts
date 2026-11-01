import { limited, ownerCookie } from "@/lib/guard";
import { z } from "zod";
import { createProduct, createShop, setPaypalProductId } from "@/lib/db";
import { createCatalogProduct, paypalConfigured } from "@/lib/paypal";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  shop: z.object({
    name: z.string().min(1),
    tagline: z.string(),
    category: z.string(),
    location: z.string(),
    fulfillment: z.enum(["pickup", "shipping"]),
    currency: z.string().default("USD"),
    policy: z.string(),
    auto_refund_limit_cents: z.number().int().min(0),
  }),
  products: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string(),
        price_cents: z.number().int().positive(),
        stock: z.number().int().min(0),
        tags: z.array(z.string()),
      }),
    )
    .min(1).max(100),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  const over = await limited(req, "publish");
  if (over) return over;
  const shop = await createShop(parsed.data.shop);
  const warnings: string[] = [];
  // Mirror every product into the PayPal Catalog Products API.
  await Promise.all(
    parsed.data.products.map(async (p) => {
      const product = await createProduct({ ...p, shop_id: shop.id, paypal_product_id: null, source: "photo" });
      if (!paypalConfigured()) return;
      try {
        const pp = await createCatalogProduct({ name: p.name, description: p.description, sku: `SHLF-${product.id}` });
        await setPaypalProductId(product.id, pp.id);
      } catch (e) {
        warnings.push(`${p.name}: ${(e as Error).message}`);
      }
    }),
  );
  return Response.json({ slug: shop.slug, warnings }, { headers: { "set-cookie": ownerCookie(shop.id) } });
}
