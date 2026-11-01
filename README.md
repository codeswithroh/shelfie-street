<p align="center"><img src="docs/banner.svg" alt="Shelfie Street: one PayPal approval, every shop on the street" width="100%"></p>

<p align="center"><b>An AI agent buys across independent shops on one PayPal approval. You pay for all of it or none of it.</b></p>

<p align="center">
  <a href="https://shelfie-ten-eta.vercel.app"><b>Live demo</b></a> ·
  <a href="#try-it-in-2-minutes">Try it</a> ·
  <a href="#how-the-money-moves">How the money moves</a> ·
  <a href="#run-it-locally">Run locally</a>
</p>

<p align="center">
  <img alt="PayPal Sandbox" src="https://img.shields.io/badge/PayPal-Sandbox-003087?logo=paypal&logoColor=white">
  <img alt="Claude" src="https://img.shields.io/badge/Claude-Opus%205.5-d97757">
  <img alt="MCP" src="https://img.shields.io/badge/MCP-Streamable%20HTTP-14161c">
  <img alt="Next.js 15" src="https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs">
  <img alt="AG Grid" src="https://img.shields.io/badge/AG%20Grid-Community-2f6bff">
  <img alt="Turso" src="https://img.shields.io/badge/Turso-libSQL-16a06a">
  <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-lightgrey">
</p>

<p align="center"><img src="docs/demo.gif" alt="Shelfie Street landing page, animated" width="860"></p>

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

## Contents

- [The problem](#the-problem)
- [What it does](#what-it-does)
- [App preview](#app-preview)
- [Try it in 2 minutes](#try-it-in-2-minutes)
- [How the money moves](#how-the-money-moves)
- [Proof from a real sandbox run](#proof-from-a-real-sandbox-run)
- [PayPal integration](#paypal-integration)
- [AI integration](#ai-integration)
- [Architecture](#architecture)
- [Run it locally](#run-it-locally)
- [Known limits](#known-limits)
- [License](#license)

## The problem

Agent checkout works for one purchase at one merchant. Real errands don't look like that.

"Birthday party for 12 on Saturday, $150 max" means a cake from the bakery, flowers from the florist and balloons from the party shop. Nobody can safely hand that to an agent, because:

| Today | With Shelfie Street |
|---|---|
| A shop sells out after the others confirm, and you're left with half a party | The agent swaps in another shop, or the whole basket unwinds |
| Five shops means five payment approvals | One PayPal approval sets a ceiling |
| You pay before the goods exist | Shops prove the order with a photo before any money moves |
| An agent that gets tricked can spend your money | Limits sit in signed mandates checked by code, not by the model |

## What it does

- **Missions.** Give the agent a goal and a budget. Claude splits it into needs, searches real shop catalogs and picks the cheapest basket.
- **Signed mandates.** An Ed25519-signed limit (ceiling, categories, expiry). Code checks it before every spend.
- **All-or-nothing baskets.** Nothing is captured until every shop has proved its part. If a basket can't complete, the authorization is voided and the buyer pays $0.
- **Automatic recovery.** A shop sells out, and the agent finds a substitute inside the mandate with no new approval.
- **Photo proof.** Each shop uploads a packing photo. Claude vision compares it with the order and treats any text in the image as evidence, not instructions.
- **Agent firewall.** Pattern rules and a Claude classifier screen outside agents' messages. Repeat offenders lose trust and get banned. A live red-team button runs five attacks.
- **Tamper-evident ledger.** Every money event is hashed to the one before it, per mission.
- **Shops from a photo.** A merchant photographs a shelf or menu. Claude builds the catalog, and the shop gets its own MCP server, product feed and `llms.txt`.
- **Demand gaps.** When agents ask for something nobody sells, it shows up as a gap, and Claude can draft the product.

## App preview

<table>
  <tr>
    <td width="50%"><img src="docs/overview.png" alt="Overview dashboard"><p align="center"><b>Overview</b>: money flow, earnings, activity</p></td>
    <td width="50%"><img src="docs/mission.png" alt="Settled mission"><p align="center"><b>Mission</b>: a sold-out shop replaced, then settled</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/firewall.png" alt="Agent firewall"><p align="center"><b>Agent firewall</b>: live attacks and trust scores</p></td>
    <td width="50%"><img src="docs/ledger.png" alt="Money ledger"><p align="center"><b>Money ledger</b>: AG Grid over the hash chain</p></td>
  </tr>
</table>

## Try it in 2 minutes

1. Open the [app](https://shelfie-ten-eta.vercel.app/app) and go to [Missions](https://shelfie-ten-eta.vercel.app/app/missions). Keep the sample goal and click **Plan basket**.
2. Click **Approve** and log in with a **US** PayPal sandbox personal account. See the note below.
3. Back on the mission, click **Shop sold out** on the florist and watch the agent replace it.
4. Upload a packing photo for each shop. Once all pass, money is captured and paid out.
5. Open [Agent firewall](https://shelfie-ten-eta.vercel.app/app/firewall) and click **Run 5 live attacks**.

> [!IMPORTANT]
> Use a **US** sandbox buyer. PayPal rejects India-to-India payments, and we saw it fail checkout with a generic "something went wrong" page. Sandbox Payouts were also refused for an India-based merchant account.

## How the money moves

Shelfie is the merchant of record. One authorization covers the whole basket, and partial captures settle each shop.

```mermaid
sequenceDiagram
    participant B as Buyer
    participant A as Agent
    participant S as Shops
    participant P as PayPal
    B->>A: Goal and $150 ceiling
    A->>S: Search catalogs, plan basket
    A->>A: Sign mandate
    B->>P: Approve up to $150
    P-->>A: Authorization, $0 charged
    A->>S: Reserve stock
    S--xA: Florist sold out
    A->>S: Substitute inside the mandate
    S->>A: Packing photos
    A->>A: Claude verifies every photo
    A->>P: Partial capture per shop
    A->>P: Payout per shop
    A->>P: Void the unused remainder
```

If no substitute fits the mandate, every reservation is released and the authorization is voided.

## Proof from a real sandbox run

A real mission on PayPal's sandbox, not a mock:

| Step | Result |
|---|---|
| Authorized | $150.00 on one buyer approval |
| Recovery | Petal & Stem sold out, Wild Bunch substituted, no new approval |
| Captured | $42.00 + $14.00 + $42.00 = $98.00, as three partial captures |
| Paid to shops | $91.14 across three payouts, accepted by PayPal |
| Released | $52.00 voided back to the buyer |
| Ledger | 18 entries, hash chain verified |

## PayPal integration

| Capability | Used for |
|---|---|
| Orders v2 `intent=AUTHORIZE` | One approval for the whole basket |
| Payments v2 capture with `final_capture: false` | One partial capture per shop |
| Payments v2 void | Releasing unused money, and all-or-nothing aborts |
| Payouts | Paying each shop after PayPal's fee and a 2% platform fee |
| Orders v2 `intent=CAPTURE` | Single-shop checkout through each shop's MCP server |
| Payments v2 refund | Front-desk refunds, capped by the merchant |
| Catalog Products | Mirroring every product into PayPal |
| Invoicing v2 | Large single-shop orders |
| Shipment Tracking | Tracking on fulfilled orders |
| Webhooks | Backstop for `PAYMENT.CAPTURE.COMPLETED` |

## AI integration

Everything runs on Claude (`claude-opus-5-5`) through the Anthropic TypeScript SDK.

| Where | How |
|---|---|
| Mission planning | Structured output turns a goal into needs |
| Catalog matching | Semantic search, with a looser mode for substitutes, that also reports unmet demand |
| Packing proof | Vision compares a photo with the order |
| Firewall | Classifier for manipulation that pattern rules miss |
| Shelf onboarding | Vision turns photos into a catalog |
| Front desk and shopper | Tool-use agents, with money limits enforced inside the tools |

AI decides what to buy. Code decides what is allowed.

## Architecture

```mermaid
flowchart LR
    C[Claude, ChatGPT or any MCP client] -->|per-shop MCP| AF[Agent firewall]
    U[Buyer and merchant dashboards] --> API[Next.js on Vercel]
    AF --> API
    API --> E[Mission engine]
    E --> M[Mandate check]
    E --> AI[Claude]
    E --> PP[PayPal REST APIs]
    E --> DB[(Turso: missions, ledger)]
    PP -->|webhook| API
```

| Path | Purpose |
|---|---|
| [`src/lib/street/saga.ts`](src/lib/street/saga.ts) | Mission state machine: plan, reserve, recover, settle, abort |
| [`src/lib/street/mandate.ts`](src/lib/street/mandate.ts) | Signing and the single spend gate |
| [`src/lib/street/firewall.ts`](src/lib/street/firewall.ts) | Input screening and agent trust |
| [`src/lib/street/store.ts`](src/lib/street/store.ts) | Persistence and the hash-chained ledger |
| [`src/lib/paypal.ts`](src/lib/paypal.ts) | PayPal REST client |
| [`src/lib/mcp.ts`](src/lib/mcp.ts) | Per-shop MCP server |

## Run it locally

Requires Node.js 22.5 or newer.

```bash
git clone https://github.com/codeswithroh/shelfie-street.git
cd shelfie-street
npm install
cp .env.example .env.local
npm run dev
```

| Variable | Where it comes from |
|---|---|
| `ANTHROPIC_API_KEY` | [Claude Console](https://console.anthropic.com) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | A **Merchant** sandbox app in the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox), linked to a **US** business account |
| `APP_URL` | The URL this app runs on |
| `MANDATE_SIGNING_KEY` | Base64 PKCS#8 Ed25519 key. Optional locally, required on Vercel |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Production only. Local runs use a SQLite file |
| `PAYPAL_WEBHOOK_ID` | Optional |

Open `/app` and click **Open the demo street** to seed six shops.

## Known limits

This is a hackathon build on PayPal's sandbox.

- There are no user accounts, so anyone with a link can act on a mission or shop.
- Demo shops use placeholder payout addresses, so payouts can stay pending or unclaimed.
- The proof check can be fooled by a realistic generated image. It raises the cost of lying, and it isn't fraud detection.
- A live product would need PayPal's approval for this marketplace-style flow, plus real seller onboarding.

## License

[MIT](LICENSE)
