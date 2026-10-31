"use client";

import { useCallback, useEffect, useState } from "react";
import type { LedgerEntry, Mission } from "@/lib/street/store";

export type StreetState = {
  shops: { id: string; slug: string; name: string; category: string; items: number; lines: number; earned_cents: number }[];
  missions: Mission[];
  ledger: LedgerEntry[];
  firewall: { id: string; agent_name: string; verdict: string; rule: string; input: string; created_at: string }[];
  agents: { name: string; trust: number; blocked: number; last_seen: string }[];
  gaps: { label: string; count: number; shops: string[] }[];
};

export const usd = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

export function usePoll<T>(url: string, ms = 2500) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
      setData(await res.json());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [url]);
  useEffect(() => {
    load();
    const t = setInterval(load, ms);
    return () => clearInterval(t);
  }, [load, ms]);
  return { data, error, reload: load };
}

export const useStreet = () => usePoll<StreetState>("/api/street/state");

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "accent" | "dark" | "sage" }) {
  const cls = tone === "accent" ? "bg-tomato text-white" : tone === "dark" ? "bg-ink text-paper" : tone === "sage" ? "bg-sage text-white" : "card";
  return (
    <div className={`rounded-[14px] p-4 ${cls}`}>
      <div className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</div>
      <div className="font-display mt-1 text-4xl">{value}</div>
    </div>
  );
}

export function Donut({ parts, center, caption }: { parts: { label: string; value: number; color: string }[]; center: string; caption: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 52, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={caption}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="#ece5d6" strokeWidth="16" />
        {total > 0 && parts.filter((p) => p.value > 0).map((p) => {
          const len = (p.value / total) * c;
          const el = <circle key={p.label} cx="70" cy="70" r={r} fill="none" stroke={p.color} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />;
          offset += len;
          return el;
        })}
        <text x="70" y="75" textAnchor="middle" fontSize="19" fontWeight="700" fill="#1d1b17">{center}</text>
      </svg>
      <ul className="space-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            <span className="text-ink-2">{p.label}</span>
            <b className="font-mono text-xs">{usd(p.value)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

const CHIPS: Record<string, string> = {
  AWAITING_APPROVAL: "bg-butter text-ink", EXECUTING: "bg-[#dde7f1] text-sky", AWAITING_PROOF: "bg-[#dde7f1] text-sky",
  SETTLED: "bg-sage-soft text-sage", ABORTED: "bg-[#f6dcd3] text-tomato-ink", PLANNED: "bg-paper-2 text-ink-2",
  RESERVED: "bg-[#dde7f1] text-sky", VERIFIED: "bg-sage-soft text-sage", CAPTURED: "bg-sage-soft text-sage", PAID_OUT: "bg-sage text-white",
  REPLACED: "bg-[#f6dcd3] text-tomato-ink", RELEASED: "bg-paper-2 text-ink-3", PROOF_REJECTED: "bg-[#f6dcd3] text-tomato-ink",
  BLOCKED: "bg-[#f6dcd3] text-tomato-ink", ALLOWED: "bg-sage-soft text-sage",
};

export const Chip = ({ s }: { s: string }) => <span className={`pill ${CHIPS[s] ?? "bg-paper-2 text-ink-2"}`}>{s.replaceAll("_", " ").toLowerCase()}</span>;

export const Empty = ({ children }: { children: React.ReactNode }) => <div className="card p-6 text-center text-sm text-ink-3">{children}</div>;
