# Shelfie

**Snap a photo of your shelf, and AI agents can buy from you by lunch.**

People are starting to shop through AI assistants. Small shops (a bakery, a thrift store, a florist) have no API, no product feed and no checkout an agent can use, so those assistants can't buy from them. Shelfie makes any small shop buyable by AI agents from a single photo, and PayPal handles payment.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

## What it does

1. **Photo to catalog.** The merchant uploads a photo of their shelf, menu board or price list. Claude vision reads every item, price and attribute (vegan, contains nuts, serves 10…) and builds a catalog for the merchant to review. Each product is also created in the **PayPal Catalog Products API**.
2. **Agent-ready storefront.** Every shop gets:
   - its own **MCP server** at `/s/{shop}/mcp`, which Claude, ChatGPT or any other MCP client can connect to
   - a machine-readable product feed (`/s/{shop}/feed.json`), `llms.txt`, and schema.org JSON-LD
3. **PayPal checkout for agents.** Agents search, quote and call `create_order`, which creates a **PayPal Orders v2** order and returns the approval link. The human buyer approves on PayPal, and Shelfie captures the payment when they return. A verified **PayPal webhook** (`PAYMENT.CAPTURE.COMPLETED`) is a backstop. Orders above a threshold are sent as **PayPal Invoices** (NET 10) instead.
4. **AI front desk.** A Claude agent answers questions from buyer agents, and decides refund requests using the merchant's plain-English policy. It issues real **PayPal refunds** up to a limit the merchant sets, and escalates anything else to the owner.
5. **Agent ledger.** An AG Grid dashboard that updates live and shows every order: which agent placed it, who it was for, and its PayPal status. From there the merchant can fulfill an order (tracking goes to PayPal through the **Shipment Tracking API**) or refund it.
6. **Demand gaps.** When an agent asks for something the shop doesn't sell ("gluten-free bread"), Shelfie records it as a demand gap. The merchant sees *"gluten-free bread ×14"*, Claude drafts the product with one click, and it goes onto the shelf and into PayPal's catalog.

## PayPal integration

| Capability | Where |
|---|---|
| OAuth2 client credentials | `src/lib/paypal.ts` |
| Catalog Products API: `POST /v1/catalogs/products` | onboarding, demand-gap products |
| Orders v2: create (with `experience_context`), get, capture | `create_order` MCP tool, `/checkout/return` |
| Payments v2: refund a capture | AI front desk `issue_refund`, merchant refunds |
| Shipment Tracking: `POST /v2/checkout/orders/{id}/track` | dashboard "Fulfill" |
| Invoicing v2: create, send, get | large orders (`INVOICE_THRESHOLD_CENTS`) |
| Webhooks: verify signature, `PAYMENT.CAPTURE.COMPLETED` | `/api/webhooks/paypal` |

## AI integration

All AI runs on **Claude (`claude-opus-5-5`)** through the Anthropic TypeScript SDK (`src/lib/ai.ts`, `src/lib/frontdesk.ts`):

- **Vision + structured outputs** (Zod schema): shelf photos become a typed catalog.
- **Semantic search with gap detection**: each agent search returns matching products *and* a canonical "unmet need" label, which feeds the demand-gap view.
- **Tool-use agents** (SDK tool runner):
  - the merchant's *front desk* (tools: `lookup_order`, `issue_refund` (capped), `escalate_to_merchant`)
  - the in-app *shopper playground* (Claude using the same tools the MCP server exposes)
- **MCP server** (`@modelcontextprotocol/sdk`, Streamable HTTP): the shop-facing interface for outside agents. The agent's name comes from the MCP `clientInfo` and is recorded in the ledger.
- Server-side refusal fallback is enabled (`fallbacks: "default"`).

AG Grid Community powers the agent ledger and the editable shelf.

## Run it locally

Requirements: **Node.js 22.5+**. Local runs use a SQLite file in `data/`; production uses Turso.

```bash
git clone <this repo> && cd shelfie
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

`.env.local`:

| Variable | How to get it |
|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox): Apps & Credentials, Sandbox, Create App |
| `APP_URL` | The URL the app is served on (PayPal sends buyers back here) |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Production only. Added automatically by the Turso integration on Vercel |
| `PAYPAL_WEBHOOK_ID` | Optional. Create a webhook pointing at `{APP_URL}/api/webhooks/paypal` for `PAYMENT.CAPTURE.COMPLETED` |

To pay in the sandbox, log in on the PayPal approval page with a **sandbox personal account** (Developer Dashboard, Testing Tools, Sandbox Accounts).

### Try it in two minutes

1. Open the app and click **Open the demo bakery** (or **Snap my shelf** to use your own photo).
2. Click **Shop as an agent**, then try:
   - *"Order 2 sourdough loaves for Saturday pickup, for Alex"*: approve on PayPal and watch the order appear in the dashboard.
   - *"Do you have gluten-free bread?"*: a demand gap appears on the dashboard. Click **Draft product**.
   - *"One loaf was squashed, can I get a refund on order …?"*: the front desk refunds it through PayPal, within policy.
3. Connect a real agent: copy the MCP URL from the dashboard into Claude (Settings, Connectors, Add custom connector). This needs a public `APP_URL`, for example the Vercel deploy below.

## Deploy (Vercel)

Import the repo into Vercel, add the Turso integration from the Marketplace, set the env vars above, and set `APP_URL` to the production URL.

## Architecture

```
 Claude / ChatGPT / any MCP client          Shelfie (Next.js on Vercel)                       PayPal (sandbox)
 ───────────────────────────────            ──────────────────────────                       ────────────────
 search_products ─────────────────────────▶ /s/{shop}/mcp ─▶ Claude: match + demand gap
 create_order ────────────────────────────▶ commerce.placeOrder ───────────────────────────▶ Orders v2 / Invoicing
 human approves on paypal.com ◀────────────────────────────────────────────────────────────── approval link
                                            /checkout/return ─▶ capture ──────────────────────▶ Orders v2 capture
 request_refund ──────────────────────────▶ front desk agent (Claude tools) ─ issue_refund ──▶ Payments v2 refund
 merchant dashboard (AG Grid) ◀───────────── Turso (libSQL) ◀─ webhook ◀───────────────── PAYMENT.CAPTURE.COMPLETED
```

## License

MIT
