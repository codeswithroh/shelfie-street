// Turns a goal into needs, finds real products across the street, and picks the basket.
import { z } from "zod";
import { type Product, type Shop, listProducts, listShops } from "../db";
import { matchCatalog, parseStructured } from "../ai";
import type { Need } from "./store";

const Plan = z.object({
  needs: z.array(z.object({
    key: z.string().describe("short slug, unique in this plan, e.g. cake"),
    label: z.string().describe("What the buyer gets, e.g. Birthday cake for 12"),
    category: z.string().describe("One of the street categories listed in the prompt"),
    quantity: z.number().int().describe("Purchasable units, not people. A cake serving 12 is 1. A pack of 12 balloons is 1. Default to 1"),
    query: z.string().describe("Search text for a shop's catalog, including dietary or size requirements from the goal"),
  })),
  unmet: z.array(z.string()).describe("Parts of the goal no street category can cover"),
});

export async function decomposeGoal(goal: string, budgetCents: number, shops: Shop[]) {
  const categories = [...new Set(shops.map((s) => s.category))];
  return parseStructured({
    schema: Plan,
    effort: "medium",
    system: "You plan errands for a buyer's AI agent. Break the goal into the fewest separately purchasable needs. Use only the categories given. Never add items the buyer did not imply.",
    content: [{ type: "text", text: `Street categories: ${categories.join(", ")}\nBudget: $${(budgetCents / 100).toFixed(2)}\nGoal: ${goal}` }],
  });
}

export type Option = { need: Need; shop: Shop; product: Product };

export async function findOptions(need: Need, shops: Shop[], excludeShopIds: string[] = [], substitute = false): Promise<Option[]> {
  const candidates = shops.filter((s) => s.category === need.category && !excludeShopIds.includes(s.id));
  const found = await Promise.all(candidates.map(async (shop) => {
    const products = (await listProducts(shop.id)).filter((p) => p.stock >= need.quantity);
    if (!products.length) return null;
    const match = await matchCatalog(shop, products, need.query, substitute);
    const product = products.find((p) => p.id === match.product_ids[0]);
    return product ? { need, shop, product } : null;
  }));
  return found.filter((o): o is Option => o !== null);
}

export const optionCost = (o: Option) => o.product.price_cents * o.need.quantity;

/** Cheapest basket with one option per need, charging a small cost per extra shop visited. Exhaustive: baskets are small. */
export function chooseBasket(optionsByNeed: Option[][], budgetCents: number, shopPenaltyCents = 150): Option[] | null {
  let best: { picks: Option[]; score: number } | null = null;
  const walk = (i: number, picks: Option[], cost: number) => {
    if (cost > budgetCents) return;
    if (i === optionsByNeed.length) {
      const score = cost + new Set(picks.map((p) => p.shop.id)).size * shopPenaltyCents;
      if (!best || score < best.score) best = { picks: [...picks], score };
      return;
    }
    for (const o of optionsByNeed[i]) walk(i + 1, [...picks, o], cost + optionCost(o));
  };
  walk(0, [], 0);
  return (best as { picks: Option[] } | null)?.picks ?? null;
}

export { listShops };
