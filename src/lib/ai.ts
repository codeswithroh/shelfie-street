import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Product, Shop } from "./db";

export const MODEL = process.env.SHELFIE_MODEL ?? "claude-opus-5-5";

declare global {
  var __anthropic: Anthropic | undefined;
}

export function claude(): Anthropic {
  if (!globalThis.__anthropic) globalThis.__anthropic = new Anthropic();
  return globalThis.__anthropic;
}

// Server-side refusal fallback: if the primary model declines, the API reruns the
// request on a routed fallback model inside the same call.
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

type ImageInput = { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string };

export async function parseStructured<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  effort: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const res = await claude().beta.messages.parse({
    ...FALLBACK,
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
    messages: [{ role: "user", content: opts.content }],
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
  if (!res.parsed_output) throw new Error(`Could not parse model output (stop_reason=${res.stop_reason})`);
  return res.parsed_output as z.infer<T>;
}

// ---------- 1. Shelf photo -> catalog ----------

export const ExtractedCatalog = z.object({
  shop: z.object({
    suggested_name: z.string().describe("A shop name if one is visible (signage, labels), otherwise an empty string"),
    category: z.string().describe("e.g. bakery, coffee shop, thrift store, florist, bookshop"),
    tagline: z.string().describe("One warm sentence describing the shop, from what is visible"),
  }),
  products: z.array(
    z.object({
      name: z.string(),
      description: z.string().describe("One or two sentences a shopping agent can use to match buyer requests"),
      price_cents: z.number().int().describe("Price in cents. If no price tag is visible, estimate a fair local price"),
      price_visible: z.boolean().describe("True only if a price was actually readable in the photo or text"),
      stock_estimate: z.number().int().describe("Units visible, or a reasonable default of 10"),
      tags: z.array(z.string()).describe("Lowercase attributes: dietary (vegan, gluten-free), material, size, occasion, flavor"),
    }),
  ),
  notes: z.string().describe("Anything the merchant should double-check, e.g. unreadable prices"),
});
export type ExtractedCatalog = z.infer<typeof ExtractedCatalog>;

export async function extractCatalog(images: ImageInput[], text: string, currency: string) {
  const content: Anthropic.Beta.BetaContentBlockParam[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mediaType, data: img.data },
  }));
  content.push({
    type: "text",
    text:
      `Build a sellable product catalog from ${images.length ? "these photos of a small shop's shelves, menu board or price list" : "this description of a small shop"}.` +
      (text ? `\n\nMerchant notes / pasted menu:\n${text}` : "") +
      `\n\nCurrency: ${currency}. One product per distinct sellable item (merge duplicates, split sizes into separate products only if priced differently).`,
  });
  return parseStructured({
    schema: ExtractedCatalog,
    effort: "medium",
    system:
      "You digitize small independent shops so AI shopping agents can buy from them. Be accurate: read price tags exactly; never invent items that are not shown or described. Descriptions should mention ingredients, materials and attributes that buyers ask about.",
    content,
  });
}

// ---------- 2. Agent search -> matches + demand gap ----------

export const CatalogMatch = z.object({
  product_ids: z.array(z.string()).describe("IDs of products that genuinely satisfy the request, best first. Empty if none do."),
  explanation: z.string().describe("One sentence for the shopping agent about what matched and why"),
  unmet_need: z
    .string()
    .describe(
      "If the request asks for something this shop does not offer (or an attribute no product has), a short canonical label for that missing demand, e.g. 'gluten-free bread', 'oat milk', 'vegan cake'. Empty string when fully satisfied.",
    ),
});

export async function matchCatalog(shop: Shop, products: Product[], query: string, substitute = false) {
  const catalog = products
    .map((p) => `- id=${p.id} | ${p.name} | ${(p.price_cents / 100).toFixed(2)} ${shop.currency} | stock ${p.stock} | tags: ${p.tags.join(", ")} | ${p.description}`)
    .join("\n");
  return parseStructured({
    schema: CatalogMatch,
    effort: "low",
    maxTokens: 4000,
    system: `You are the product search engine for ${shop.name} (${shop.category}). ${substitute ? "The buyer's first choice fell through. Return the closest product that does the same job, even if the style or format differs. Only return nothing if the shop has no product for that purpose." : "Match shopping-agent requests to the catalog strictly; do not stretch matches."}`,
    content: [{ type: "text", text: `Catalog:\n${catalog || "(empty)"}\n\nAgent request: ${query}` }],
  });
}

// ---------- 3. Demand gap -> product draft ----------

export const ProductDraft = z.object({
  name: z.string(),
  description: z.string(),
  price_cents: z.number().int(),
  tags: z.array(z.string()),
  rationale: z.string().describe("Why this product closes the gap, citing the agent requests"),
});

export async function draftProductForGap(shop: Shop, products: Product[], label: string, examples: string[]) {
  return parseStructured({
    schema: ProductDraft,
    effort: "low",
    maxTokens: 4000,
    system: `You help ${shop.name}, a ${shop.category}, turn unmet AI-shopper demand into a product. Price it consistently with the existing catalog.`,
    content: [
      {
        type: "text",
        text: `Existing catalog:\n${products.map((p) => `- ${p.name}: ${(p.price_cents / 100).toFixed(2)} ${shop.currency}`).join("\n")}\n\nUnmet demand: "${label}"\nRecent agent requests:\n${examples.map((e) => `- ${e}`).join("\n")}`,
      },
    ],
  });
}
