"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Nav } from "@/components/Brand";

type Msg = { role: "user" | "assistant"; content: string };
type Step = { tool: string; input: unknown; output: string; ok: boolean };

const SUGGEST: Record<string, string[]> = {
  default: [
    "What do you have that's vegan?",
    "Order 2 of your most popular items for pickup tomorrow, for Alex",
    "Do you have anything gluten-free?",
  ],
  bakery: [
    "Order 2 sourdough loaves for Saturday pickup, for Alex",
    "Do you have gluten-free bread?",
    "I need a birthday cake for 10 people",
    "Do you sell oat milk lattes?",
  ],
};

function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          p.includes("paypal.com") ? (
            <a key={i} href={p} target="_blank" className="my-2 flex w-fit items-center gap-2 rounded-full bg-[#ffc439] px-4 py-2 font-semibold text-[#111]">
              Approve with PayPal ↗
            </a>
          ) : (
            <a key={i} href={p} target="_blank" className="break-all underline">{p}</a>
          )
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export default function Playground({ slug, shopName, category }: { slug: string; shopName: string; category: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [steps, setSteps] = useState<{ turn: number; steps: Step[] }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [buyer, setBuyer] = useState("Alex");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, busy]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next = [...messages, { role: "user" as const, content: text.trim() }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/playground", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, buyer, messages: next }) });
      const json = await res.json();
      setSteps((s) => [...s, { turn: next.length, steps: json.steps ?? [] }]);
      setMessages([...next, { role: "assistant", content: json.reply ?? `⚠️ ${json.error}` }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = SUGGEST[category] ?? SUGGEST.default;

  return (
    <>
      <Nav>
        <Link href={`/dashboard/${slug}`} target="_blank" className="btn btn-ghost py-2 text-sm">Open merchant dashboard ↗</Link>
      </Nav>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card flex h-[calc(100vh-130px)] min-h-[520px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div>
              <div className="font-semibold">Your AI shopping agent</div>
              <div className="text-xs text-ink-3">Claude, connected to {shopName} via its Shelfie MCP tools</div>
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-3">
              Shopping for
              <input className="input w-24 py-1 text-sm" value={buyer} onChange={(e) => setBuyer(e.target.value)} />
            </label>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.length === 0 && (
              <div className="py-8 text-center">
                <div className="font-display text-4xl">What does {buyer || "your buyer"} need?</div>
                <p className="mt-2 text-sm text-ink-3">Ask in plain words. The agent searches, quotes, and hands you a PayPal link to approve.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {suggestions.map((s) => (
                    <button key={s} className="btn btn-ghost py-1.5 text-sm" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${m.role === "user" ? "bg-ink text-paper" : "bg-paper-2"}`}>
                  <Linkified text={m.content} />
                </div>
              </div>
            ))}
            {busy && <div className="text-sm text-ink-3">Agent is working with {shopName}…</div>}
            <div ref={endRef} />
          </div>
          <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input className="input" placeholder="e.g. one croissant was missing from my order, can I get a refund?" value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} />
            <button className="btn btn-primary" disabled={busy || !input.trim()}>Send</button>
          </form>
        </section>

        <section className="min-w-0">
          <h2 className="font-display text-3xl">Under the hood</h2>
          <p className="text-xs text-ink-3">The MCP tool calls the agent made and what the shop returned</p>
          <div className="mt-3 space-y-3">
            {steps.length === 0 && <div className="card p-4 text-sm text-ink-3">Tool calls will appear here.</div>}
            {steps.slice().reverse().flatMap((t) =>
              t.steps.map((s, j) => (
                <details key={`${t.turn}-${j}`} className="card overflow-hidden" open={j === t.steps.length - 1}>
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 font-mono text-sm">
                    <span><span className={s.ok ? "text-sage" : "text-tomato"}>●</span> {s.tool}</span>
                    <span className="truncate pl-3 text-xs text-ink-3">{JSON.stringify(s.input)}</span>
                  </summary>
                  <pre className="max-h-64 overflow-auto bg-ink px-4 py-3 font-mono text-[11.5px] leading-relaxed text-paper">{s.output}</pre>
                </details>
              )),
            )}
          </div>
        </section>
      </main>
    </>
  );
}
