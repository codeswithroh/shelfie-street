// A ready-made demo shop so judges can try the agent flow without photographing anything.
import { type Shop, createProduct, createShop, getShop, run, setPaypalProductId } from "./db";
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

const POLICY = "Refund missing or damaged items in full. No refund for change of mind. Escalate anything unusual to the owner.";
type P = { name: string; price_cents: number; stock: number; tags: string[]; description: string };
const STREET: { name: string; slug: string; tagline: string; category: string; products: P[] }[] = [
  {
    name: "Golden Crust", slug: "golden-crust", tagline: "Old-school bakery known for celebration cakes.", category: "bakery",
    products: [
      { name: "Vanilla Celebration Cake", price_cents: 4800, stock: 4, tags: ["cake", "birthday", "serves 12"], description: "Three-layer vanilla sponge with buttercream. Serves 12." },
      { name: "Chocolate Fudge Cake", price_cents: 5200, stock: 3, tags: ["cake", "birthday", "chocolate", "serves 12"], description: "Dark chocolate layers with fudge frosting. Serves 12." },
    ],
  },
  {
    name: "Petal & Stem", slug: "petal-stem", tagline: "Seasonal flowers tied to order.", category: "florist",
    products: [
      { name: "Bright Birthday Bouquet", price_cents: 3500, stock: 5, tags: ["flowers", "birthday", "bouquet"], description: "Gerberas and tulips in bright colours." },
      { name: "Table Posy", price_cents: 1200, stock: 12, tags: ["flowers", "table", "small"], description: "Small posy for a table centre." },
    ],
  },
  {
    name: "Wild Bunch", slug: "wild-bunch", tagline: "Loose, garden-style flowers.", category: "florist",
    products: [{ name: "Garden Birthday Bunch", price_cents: 4200, stock: 4, tags: ["flowers", "birthday", "bouquet"], description: "Loose garden flowers wrapped in paper." }],
  },
  {
    name: "Pop Party Supply", slug: "pop-party", tagline: "Balloons, candles and paper goods.", category: "party supplies",
    products: [
      { name: "Balloon Pack (12)", price_cents: 1400, stock: 20, tags: ["balloons", "birthday"], description: "12 helium-quality latex balloons in mixed colours." },
      { name: "Number Candle Set", price_cents: 600, stock: 30, tags: ["candles", "birthday", "cake"], description: "Gold number candles, 0 to 9." },
      { name: "Party Plates & Cups for 12", price_cents: 1600, stock: 15, tags: ["tableware", "serves 12"], description: "Paper plates, cups and napkins for 12." },
    ],
  },
  {
    name: "Corner Market", slug: "corner-market", tagline: "Drinks and snacks, open late.", category: "grocery",
    products: [
      { name: "Sparkling Lemonade Case (12)", price_cents: 1800, stock: 10, tags: ["drinks", "non-alcoholic", "serves 12"], description: "12 cans of sparkling lemonade." },
      { name: "Fruit Platter", price_cents: 2800, stock: 4, tags: ["fruit", "vegan", "serves 12"], description: "Cut seasonal fruit for 12." },
    ],
  },
];

async function joinStreet(shop: Shop) {
  await run("INSERT OR IGNORE INTO street_shops (shop_id, payout_email) VALUES (?, ?)", [shop.id, `${shop.slug}@shelfie-demo.example`]);
}

export async function ensureDemoStreet() {
  await ensureDemoShop();
  await joinStreet((await getShop("crumb-co"))!);
  for (const { products, slug, ...fields } of STREET) {
    let shop = await getShop(slug);
    if (!shop) {
      shop = await createShop({ ...fields, location: "Mission District, San Francisco", fulfillment: "pickup", currency: "USD", policy: POLICY, auto_refund_limit_cents: 1500 });
      for (const p of products) {
        const product = await createProduct({ ...p, shop_id: shop.id, paypal_product_id: null, source: "demo" });
        if (!paypalConfigured()) continue;
        const pp = await createCatalogProduct({ name: p.name, description: p.description, sku: `SHLF-${product.id}` });
        await setPaypalProductId(product.id, pp.id);
      }
    }
    await joinStreet(shop);
  }
}
