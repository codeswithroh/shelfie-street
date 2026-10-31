// A ready-made demo shop so judges can try the agent flow without photographing anything.
import { createProduct, createShop, getShop, setPaypalProductId } from "./db";
import { createCatalogProduct, paypalConfigured } from "./paypal";

const DEMO = {
  name: "Crumb & Co.",
  tagline: "A tiny neighbourhood bakery baking naturally-leavened bread and pastries every morning.",
  category: "bakery",
  location: "Mission District, San Francisco",
  fulfillment: "pickup",
  currency: "USD",
  policy:
    "Pickup 7am–2pm daily. Orders placed before 9pm are ready next morning.\n" +
    "Refunds: if an item is missing or damaged, refund that item in full. If the buyer simply changed their mind after pickup, no refund.\n" +
    "Custom cakes need 48 hours notice — escalate these to the owner.",
  auto_refund_limit_cents: 1500,
  products: [
    { name: "Country Sourdough Loaf", price_cents: 900, stock: 14, tags: ["bread", "vegan", "naturally leavened"], description: "Our 36-hour fermented house loaf with a blistered crust. Wheat, water, salt, starter." },
    { name: "Seeded Rye", price_cents: 1000, stock: 8, tags: ["bread", "vegan", "rye", "seeded"], description: "Dense Nordic-style rye with sunflower, flax and pumpkin seeds." },
    { name: "Butter Croissant", price_cents: 475, stock: 24, tags: ["pastry", "vegetarian", "laminated"], description: "Laminated with cultured French butter. Flaky, honeycombed crumb." },
    { name: "Almond Croissant", price_cents: 575, stock: 12, tags: ["pastry", "vegetarian", "nuts", "almond"], description: "Twice-baked croissant filled with almond frangipane. Contains nuts." },
    { name: "Cardamom Bun", price_cents: 500, stock: 18, tags: ["pastry", "vegetarian", "cardamom", "swedish"], description: "Swedish-style knotted bun with freshly ground cardamom and pearl sugar." },
    { name: "Chocolate Chip Cookie", price_cents: 350, stock: 30, tags: ["cookie", "vegetarian", "chocolate"], description: "Brown-butter cookie with dark chocolate chunks and flaky salt." },
    { name: "Lemon Olive Oil Cake (slice)", price_cents: 550, stock: 10, tags: ["cake", "dairy-free", "lemon"], description: "Moist olive oil cake with lemon glaze. Dairy-free." },
    { name: "Whole Lemon Olive Oil Cake", price_cents: 4200, stock: 3, tags: ["cake", "dairy-free", "lemon", "celebration", "serves 10"], description: "The whole 9-inch cake, serves 10. Great for birthdays and office treats." },
  ],
};

export async function ensureDemoShop() {
  const existing = await getShop("crumb-co");
  if (existing) return { slug: existing.slug, created: false, warnings: [] as string[] };
  const { products, ...shopFields } = DEMO;
  const shop = await createShop(shopFields);
  const warnings: string[] = [];
  await Promise.all(
    products.map(async (p) => {
      const product = await createProduct({ ...p, shop_id: shop.id, paypal_product_id: null, source: "demo" });
      if (!paypalConfigured()) return;
      try {
        const pp = await createCatalogProduct({ name: p.name, description: p.description, sku: `SHLF-${product.id}` });
        await setPaypalProductId(product.id, pp.id);
      } catch (e) {
        warnings.push(`${p.name}: ${(e as Error).message}`);
      }
    }),
  );
  return { slug: shop.slug, created: true, warnings };
}
