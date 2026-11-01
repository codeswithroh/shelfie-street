"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Brand";

const NAV = [
  { href: "/app", label: "Overview", icon: "▦" },
  { href: "/app/missions", label: "Missions", icon: "◎" },
  { href: "/app/shops", label: "Shops", icon: "▤" },
  { href: "/app/ledger", label: "Money ledger", icon: "≡" },
  { href: "/app/firewall", label: "Agent firewall", icon: "⛨" },
  { href: "/app/demand", label: "Demand gaps", icon: "△" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (h: string) => (h === "/app" ? path === h : path.startsWith(h));
  return (
    <div className="dash relative z-10 min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className={`${open ? "block" : "hidden"} border-b border-line bg-card p-3 md:sticky md:top-0 md:block md:h-screen md:border-b-0 md:border-r`}>
        <Link href="/" className="hidden items-center gap-2 px-2 py-3 md:flex"><Logo /><span className="font-semibold tracking-tight">Shelfie Street</span></Link>
        <nav className="mt-2 space-y-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active(n.href) ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2"}`}>
              <span className="w-4 text-center">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost px-3 py-1 md:hidden" aria-label="Menu" onClick={() => setOpen((x) => !x)}>☰</button>
            <span className="pill bg-sage-soft text-sage"><span className="live-dot" /> PayPal sandbox</span>
          </div>
          <Link href="/app/missions" className="btn btn-accent py-1.5 text-sm">+ New mission</Link>
        </div>
        <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
