import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Shop } from "./db";
import { runShopTool, shopTools } from "./tools";

type Session = { transport: WebStandardStreamableHTTPServerTransport; server: McpServer; shopId: string };

declare global {
  var __mcpSessions: Map<string, Session> | undefined;
}
const sessions = (globalThis.__mcpSessions ??= new Map());

function agentLabel(server: McpServer, req: Request) {
  const client = server.server.getClientVersion();
  if (client?.name) return client.name;
  const ua = req.headers.get("user-agent") ?? "";
  return ua.split(/[\s/]/)[0] || "unknown agent";
}

function buildServer(shop: Shop, req: Request) {
  const server = new McpServer(
    { name: `shelfie-${shop.slug}`, title: `${shop.name} (via Shelfie)`, version: "1.0.0" },
    {
      instructions:
        `You are connected to ${shop.name}, a real ${shop.category}${shop.location ? ` in ${shop.location}` : ""}. ` +
        "Use get_shop_info, then search_products to find what the buyer needs, get_quote to confirm the total, and create_order to get a PayPal approval link for the buyer. " +
        "Never claim an order is paid until the buyer has approved it on PayPal; check with get_order_status.",
    },
  );
  for (const tool of shopTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.shape,
        annotations: { readOnlyHint: tool.readOnly, openWorldHint: !tool.readOnly },
      },
      async (args: Record<string, unknown>) => {
        const res = await runShopTool(tool, shop, args, { agentName: agentLabel(server, req) });
        return { content: [{ type: "text" as const, text: res.text }], isError: !res.ok };
      },
    );
  }
  return server;
}

export async function handleMcp(shop: Shop, req: Request): Promise<Response> {
  const sessionId = req.headers.get("mcp-session-id");
  const existing = sessionId ? sessions.get(sessionId) : undefined;
  if (existing && existing.shopId === shop.id) return existing.transport.handleRequest(req);

  // Peek at the body: a fresh `initialize` starts a stateful session (so we learn the
  // client's name for the agent ledger); anything else is served statelessly.
  let body: unknown;
  if (req.method === "POST") {
    try { body = await req.clone().json(); } catch { body = undefined; }
  }
  const isInit = [body].flat().some((m) => (m as { method?: string })?.method === "initialize");

  if (isInit) {
    const server = buildServer(shop, req);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (id) => { sessions.set(id, { transport, server, shopId: shop.id }); },
      onsessionclosed: (id) => { sessions.delete(id); },
    });
    await server.connect(transport);
    return transport.handleRequest(req, { parsedBody: body });
  }

  const server = buildServer(shop, req);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req, body === undefined ? undefined : { parsedBody: body });
}
