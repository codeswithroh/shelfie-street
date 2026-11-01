// Public-demo protection. There are no accounts, so whoever creates a mission or shop
// gets a signed httpOnly cookie for it. Everyone else can look but not act.
import { createHmac, timingSafeEqual } from "node:crypto";
import { query } from "./db";

const secret = () => process.env.MANDATE_SIGNING_KEY || "local-dev-only";
const sign = (id: string) => createHmac("sha256", secret()).update(id).digest("base64url");
const cookieName = (id: string) => `own_${id.replace(/[^a-z0-9]/gi, "")}`;

export function ownerCookie(id: string) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${cookieName(id)}=${sign(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

export function isOwner(req: Request, id: string) {
  const name = cookieName(id);
  const value = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!value) return false;
  const [a, b] = [Buffer.from(value), Buffer.from(sign(id))];
  return a.length === b.length && timingSafeEqual(a, b);
}

export const notOwner = () => Response.json({ error: "View only: this was created in another browser" }, { status: 403 });

const LIMITS = {
  mission: [10, 100], chat: [30, 300], redteam: [3, 30], extract: [5, 50], draft: [10, 100],
  proof: [20, 200], publish: [5, 30], seed: [5, 30], mcp: [120, 2000],
} as const;

async function bump(key: string) {
  const rows = await query("INSERT INTO rate_limits (k, n) VALUES (?, 1) ON CONFLICT (k) DO UPDATE SET n = n + 1 RETURNING n", [key]);
  return Number(rows[0].n);
}

/** Caps per-visitor and total use of anything that spends Claude credit. Returns a 429 when over. */
export async function limited(req: Request, bucket: keyof typeof LIMITS) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const iso = new Date().toISOString();
  const [perHour, perDay] = LIMITS[bucket];
  const [mine, all] = await Promise.all([bump(`${bucket}:${ip}:${iso.slice(0, 13)}`), bump(`${bucket}:all:${iso.slice(0, 10)}`)]);
  if (mine <= perHour && all <= perDay) return null;
  return Response.json({ error: "Demo limit reached. Try again later." }, { status: 429 });
}
