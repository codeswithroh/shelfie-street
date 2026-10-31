import { type Client, type InArgs, type ResultSet, createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { customAlphabet } from "nanoid";

export const newId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

// Turso in production; a local SQLite file for development.
const DB_URL = process.env.TURSO_DATABASE_URL ?? `file:${path.join(process.cwd(), "data", "shelfie.db")}`;

const SCHEMA = `
    CREATE TABLE IF NOT EXISTS street_shops (
      shop_id TEXT PRIMARY KEY REFERENCES shops(id),
      payout_email TEXT NOT NULL,
      floor_pct INTEGER NOT NULL DEFAULT 90,
      is_open INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS agents (
      name TEXT PRIMARY KEY,
      trust INTEGER NOT NULL DEFAULT 70,
      blocked INTEGER NOT NULL DEFAULT 0,
      last_seen TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS firewall_events (
      id TEXT PRIMARY KEY,
      agent_name TEXT NOT NULL,
      shop_id TEXT,
      verdict TEXT NOT NULL,
      rule TEXT NOT NULL,
      input TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      goal TEXT NOT NULL,
      buyer TEXT NOT NULL,
      budget_cents INTEGER NOT NULL,
      status TEXT NOT NULL,
      needs TEXT NOT NULL DEFAULT '[]',
      mandate TEXT,
      signature TEXT,
      paypal_order_id TEXT,
      approve_url TEXT,
      authorization_id TEXT,
      authorized_cents INTEGER NOT NULL DEFAULT 0,
      captured_cents INTEGER NOT NULL DEFAULT 0,
      failure TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mission_lines (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id),
      need_key TEXT NOT NULL,
      shop_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cents INTEGER NOT NULL,
      status TEXT NOT NULL,
      proof TEXT,
      capture_id TEXT,
      payout_batch_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ledger (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      type TEXT NOT NULL,
      actor TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      detail TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (mission_id, seq)
    );
    CREATE INDEX IF NOT EXISTS idx_lines_mission ON mission_lines(mission_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger(created_at);
    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      fulfillment TEXT NOT NULL DEFAULT 'pickup',
      currency TEXT NOT NULL DEFAULT 'USD',
      policy TEXT NOT NULL DEFAULT '',
      auto_refund_limit_cents INTEGER NOT NULL DEFAULT 1500,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 10,
      tags TEXT NOT NULL DEFAULT '[]',
      paypal_product_id TEXT,
      source TEXT NOT NULL DEFAULT 'photo',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id),
      paypal_order_id TEXT UNIQUE,
      capture_id TEXT,
      status TEXT NOT NULL,
      items TEXT NOT NULL,
      total_cents INTEGER NOT NULL,
      refunded_cents INTEGER NOT NULL DEFAULT 0,
      buyer_name TEXT NOT NULL DEFAULT '',
      buyer_email TEXT NOT NULL DEFAULT '',
      agent_name TEXT NOT NULL DEFAULT 'unknown agent',
      on_behalf_of TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      approve_url TEXT,
      tracking TEXT,
      invoice_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id),
      kind TEXT NOT NULL,
      agent_name TEXT NOT NULL DEFAULT 'unknown agent',
      summary TEXT NOT NULL,
      query TEXT,
      matched INTEGER,
      gap_label TEXT,
      order_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_shop ON events(shop_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id, created_at);
`;

declare global {
  var __shelfieDb: Promise<Client> | undefined;
}

async function open(): Promise<Client> {
  if (DB_URL.startsWith("file:")) fs.mkdirSync(path.dirname(DB_URL.slice(5)), { recursive: true });
  const client = createClient({ url: DB_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  await client.executeMultiple(SCHEMA);
  return client;
}

function db(): Promise<Client> {
  globalThis.__shelfieDb ??= open();
  return globalThis.__shelfieDb;
}

type Row = Record<string, unknown>;

const toRows = (rs: ResultSet): Row[] =>
  rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));

export async function query(sql: string, args: InArgs = []): Promise<Row[]> {
  return toRows(await (await db()).execute({ sql, args }));
}

export async function run(sql: string, args: InArgs = []): Promise<number> {
  return (await (await db()).execute({ sql, args })).rowsAffected;
}

export const now = () => new Date().toISOString();

// ---------- types ----------

export type Shop = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  location: string;
  fulfillment: string;
  currency: string;
  policy: string;
  auto_refund_limit_cents: number;
  created_at: string;
};

export type Product = {
  id: string;
  shop_id: string;
  name: string;
  description: string;
  price_cents: number;
  stock: number;
  tags: string[];
  paypal_product_id: string | null;
  source: string;
  created_at: string;
};

export type OrderItem = { product_id: string; name: string; quantity: number; unit_cents: number };

export type Order = {
  id: string;
  shop_id: string;
  paypal_order_id: string | null;
  capture_id: string | null;
  status: "CREATED" | "PAID" | "FULFILLED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "CANCELLED" | "INVOICED";
  items: OrderItem[];
  total_cents: number;
  refunded_cents: number;
  buyer_name: string;
  buyer_email: string;
  agent_name: string;
  on_behalf_of: string;
  note: string;
  approve_url: string | null;
  tracking: { carrier: string; number: string } | null;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentEvent = {
  id: string;
  shop_id: string;
  kind: string;
  agent_name: string;
  summary: string;
  query: string | null;
  matched: number | null;
  gap_label: string | null;
  order_id: string | null;
  created_at: string;
};

const toProduct = (r: Row): Product => ({ ...(r as unknown as Product), tags: JSON.parse(String(r.tags)) });
const toOrder = (r: Row): Order => ({
  ...(r as unknown as Order),
  items: JSON.parse(String(r.items)),
  tracking: r.tracking ? JSON.parse(String(r.tracking)) : null,
});

// ---------- shops ----------

export async function listShops(): Promise<Shop[]> {
  return (await query("SELECT * FROM shops ORDER BY created_at DESC")) as unknown as Shop[];
}

export async function getShop(slug: string): Promise<Shop | null> {
  return (((await query("SELECT * FROM shops WHERE slug = ?", [slug]))[0] as unknown as Shop) ?? null);
}

export async function getShopById(id: string): Promise<Shop | null> {
  return (((await query("SELECT * FROM shops WHERE id = ?", [id]))[0] as unknown as Shop) ?? null);
}

export async function slugify(name: string): Promise<string> {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "shop";
  let slug = base;
  for (let i = 2; await getShop(slug); i++) slug = `${base}-${i}`;
  return slug;
}

export async function createShop(s: Omit<Shop, "id" | "slug" | "created_at">): Promise<Shop> {
  const shop: Shop = { ...s, id: newId(), slug: await slugify(s.name), created_at: now() };
  await run(`INSERT INTO shops (id, slug, name, tagline, category, location, fulfillment, currency, policy, auto_refund_limit_cents, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [shop.id, shop.slug, shop.name, shop.tagline, shop.category, shop.location,
      shop.fulfillment, shop.currency, shop.policy, shop.auto_refund_limit_cents, shop.created_at]);
  return shop;
}

export async function updateShopPolicy(shopId: string, policy: string, autoRefundLimitCents: number) {
  await run("UPDATE shops SET policy = ?, auto_refund_limit_cents = ? WHERE id = ?", [policy, autoRefundLimitCents, shopId]);
}

// ---------- products ----------

export async function listProducts(shopId: string): Promise<Product[]> {
  return (await query("SELECT * FROM products WHERE shop_id = ? ORDER BY created_at", [shopId])).map(toProduct);
}

export async function getProduct(id: string): Promise<Product | null> {
  const r = (await query("SELECT * FROM products WHERE id = ?", [id]))[0];
  return r ? toProduct(r) : null;
}

export async function createProduct(p: Omit<Product, "id" | "created_at">): Promise<Product> {
  const product: Product = { ...p, id: newId(), created_at: now() };
  await run(`INSERT INTO products (id, shop_id, name, description, price_cents, stock, tags, paypal_product_id, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [product.id, product.shop_id, product.name, product.description, product.price_cents,
      product.stock, JSON.stringify(product.tags), product.paypal_product_id, product.source, product.created_at]);
  return product;
}

export async function updateProduct(id: string, patch: Partial<Pick<Product, "name" | "description" | "price_cents" | "stock">>) {
  const current = await getProduct(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  await run("UPDATE products SET name = ?, description = ?, price_cents = ?, stock = ? WHERE id = ?", [next.name, next.description, next.price_cents, next.stock, id]);
  return next;
}

export async function setPaypalProductId(id: string, paypalId: string) {
  await run("UPDATE products SET paypal_product_id = ? WHERE id = ?", [paypalId, id]);
}

// ---------- orders ----------

export async function createOrderRow(o: Omit<Order, "id" | "created_at" | "updated_at" | "refunded_cents" | "capture_id" | "tracking" | "invoice_id">): Promise<Order> {
  const order: Order = {
    ...o, id: newId(), refunded_cents: 0, capture_id: null, tracking: null, invoice_id: null,
    created_at: now(), updated_at: now(),
  };
  await run(`INSERT INTO orders (id, shop_id, paypal_order_id, status, items, total_cents, buyer_name, buyer_email,
        agent_name, on_behalf_of, note, approve_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [order.id, order.shop_id, order.paypal_order_id, order.status, JSON.stringify(order.items), order.total_cents,
      order.buyer_name, order.buyer_email, order.agent_name, order.on_behalf_of, order.note, order.approve_url,
      order.created_at, order.updated_at]);
  return order;
}

export async function getOrder(id: string): Promise<Order | null> {
  const r = (await query("SELECT * FROM orders WHERE id = ?", [id]))[0];
  return r ? toOrder(r) : null;
}

export async function getOrderByPaypalId(paypalOrderId: string): Promise<Order | null> {
  const r = (await query("SELECT * FROM orders WHERE paypal_order_id = ?", [paypalOrderId]))[0];
  return r ? toOrder(r) : null;
}

export async function listOrders(shopId: string): Promise<Order[]> {
  return (await query("SELECT * FROM orders WHERE shop_id = ? ORDER BY created_at DESC", [shopId])).map(toOrder);
}

export async function updateOrder(id: string, patch: Partial<Pick<Order, "status" | "capture_id" | "refunded_cents" | "tracking" | "invoice_id" | "buyer_name" | "buyer_email" | "paypal_order_id" | "approve_url">>) {
  const current = await getOrder(id);
  if (!current) return null;
  const next = { ...current, ...patch, updated_at: now() };
  await run(`UPDATE orders SET status = ?, capture_id = ?, refunded_cents = ?, tracking = ?, invoice_id = ?,
        buyer_name = ?, buyer_email = ?, paypal_order_id = ?, approve_url = ?, updated_at = ? WHERE id = ?`, [next.status, next.capture_id, next.refunded_cents, next.tracking ? JSON.stringify(next.tracking) : null,
      next.invoice_id, next.buyer_name, next.buyer_email, next.paypal_order_id, next.approve_url, next.updated_at, id]);
  return next;
}

export async function decrementStock(items: OrderItem[]) {
  for (const it of items) await run("UPDATE products SET stock = MAX(stock - ?, 0) WHERE id = ?", [it.quantity, it.product_id]);
}

// ---------- events ----------

export async function logEvent(e: Omit<AgentEvent, "id" | "created_at" | "query" | "matched" | "gap_label" | "order_id"> & Partial<Pick<AgentEvent, "query" | "matched" | "gap_label" | "order_id">>): Promise<AgentEvent> {
  const ev: AgentEvent = {
    query: null, matched: null, gap_label: null, order_id: null,
    ...e, id: newId(), created_at: now(),
  };
  await run(`INSERT INTO events (id, shop_id, kind, agent_name, summary, query, matched, gap_label, order_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [ev.id, ev.shop_id, ev.kind, ev.agent_name, ev.summary, ev.query, ev.matched, ev.gap_label, ev.order_id, ev.created_at]);
  return ev;
}

export async function setEventGap(id: string, label: string | null) {
  await run("UPDATE events SET gap_label = ? WHERE id = ?", [label, id]);
}

export async function listEvents(shopId: string, limit = 200): Promise<AgentEvent[]> {
  return (await query("SELECT * FROM events WHERE shop_id = ? ORDER BY created_at DESC LIMIT ?", [shopId, limit])) as unknown as AgentEvent[];
}

export type DemandGap = { label: string; count: number; agents: number; last_seen: string; examples: string[] };

export async function listDemandGaps(shopId: string): Promise<DemandGap[]> {
  const rows = await query(`SELECT gap_label AS label, COUNT(*) AS count, COUNT(DISTINCT agent_name) AS agents, MAX(created_at) AS last_seen,
              json_group_array(query) AS examples
       FROM events WHERE shop_id = ? AND gap_label IS NOT NULL AND gap_label != ''
       GROUP BY gap_label ORDER BY count DESC, last_seen DESC`, [shopId]);
  return rows.map((r) => ({
    label: String(r.label),
    count: Number(r.count),
    agents: Number(r.agents),
    last_seen: String(r.last_seen),
    examples: [...new Set((JSON.parse(String(r.examples)) as string[]).filter(Boolean))].slice(0, 4),
  }));
}

export async function clearGap(shopId: string, label: string) {
  await run("UPDATE events SET gap_label = NULL WHERE shop_id = ? AND gap_label = ?", [shopId, label]);
}

export const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
