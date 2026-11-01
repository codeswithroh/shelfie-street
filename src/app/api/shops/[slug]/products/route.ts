import { isOwner, notOwner } from "@/lib/guard";
import { z } from "zod";
import { clearGap, createProduct, getProduct, getShop, setPaypalProductId, updateProduct } from "@/lib/db";
import { createCatalogProduct, paypalConfigured } from "@/lib/paypal";

export const runtime = "nodejs";

const Patch = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price_cents: z.number().int().positive().optional(),
  stock: z.number().int().min(0).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const shop = await getShop((await params).slug);
  if (shop && !isOwner(req, shop.id)) return notOwner();
  const body = Patch.safeParse(await req.json());
  if (!shop || !body.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const p = await getProduct(body.data.id);
  if (!p || p.shop_id !== shop.id) return Response.json({ error: "Unknown product" }, { status: 404 });
  const { id, ...patch } = body.data;
  return Response.json(await updateProduct(id, patch));
}

const Create = z.object({
  name: z.string().min(1),
  description: z.string(),
  price_cents: z.number().int().positive(),
  stock: z.number().int().min(0).default(10),
  tags: z.array(z.string()).default([]),
  from_gap: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const shop = await getShop((await params).slug);
  if (shop && !isOwner(req, shop.id)) return notOwner();
  const body = Create.safeParse(await req.json());
  if (!shop || !body.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const { from_gap, ...fields } = body.data;
  const product = await createProduct({ ...fields, shop_id: shop.id, paypal_product_id: null, source: from_gap ? "demand-gap" : "manual" });
  if (from_gap) await clearGap(shop.id, from_gap);
  if (paypalConfigured()) {
    try {
      const pp = await createCatalogProduct({ name: product.name, description: product.description, sku: `SHLF-${product.id}` });
      await setPaypalProductId(product.id, pp.id);
    } catch (e) {
      return Response.json({ product, warning: (e as Error).message });
    }
  }
  return Response.json({ product });
}
