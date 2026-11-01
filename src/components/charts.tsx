"use client";

import { usd } from "./street";

export const PALETTE = ["#2f6bff", "#16a06a", "#ff9d42", "#f062a8", "#7b5cff", "#20b6d8"];

export function Card({ title, right, children, className = "" }: { title?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card min-w-0 p-5 ${className}`}>
      {(title || right) && <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold tracking-tight">{title}</h2>{right}</div>}
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, color = "#2f6bff", icon }: { label: string; value: string; hint?: string; color?: string; icon: string }) {
  return (
    <div className="card min-w-0 p-4">
      <div className="flex items-center justify-between text-sm text-ink-2"><span className="truncate">{label}</span><span className="grid h-7 w-7 place-items-center rounded-lg text-sm" style={{ background: `${color}1a`, color }}>{icon}</span></div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

/** Stepped funnel: each stage is a striped column, dropping left to right. */
export function Funnel({ stages }: { stages: { label: string; cents: number; color: string }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.cents));
  return (
    <div className="grid h-56 grid-cols-2 gap-1.5 sm:grid-cols-4">
      {stages.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-col">
          <div className="text-xs text-ink-3">{s.label}</div>
          <div className="text-xl font-semibold tracking-tight">{usd(s.cents)}</div>
          <div className="mt-2 flex flex-1 items-end rounded-lg bg-paper-2">
            <div className="hatch g-grow-y w-full rounded-lg" style={{ height: `${Math.max(2, (s.cents / max) * 100)}%`, ["--c" as string]: s.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HatchRows({ rows }: { rows: { label: string; value: number; display: string; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between gap-2 text-sm"><span className="truncate text-ink-2">{r.label}</span><b className="font-semibold">{r.display}</b></div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-paper-2"><div className="hatch g-grow-x h-full rounded-full" style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, ["--c" as string]: r.color }} /></div>
        </div>
      ))}
    </div>
  );
}

/** Dot histogram: one column per bucket, tallest highlighted. */
export function DotHistogram({ values, color = "#16a06a" }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  const levels = 6;
  return (
    <div className="flex h-24 items-end justify-between gap-[3px]">
      {values.map((v, i) => {
        const dots = v ? Math.max(1, Math.round((v / max) * levels)) : 1;
        return (
          <div key={i} className="flex flex-col-reverse gap-[3px]">
            {Array.from({ length: dots }).map((_, d) => (
              <i key={d} className="g-dot block h-2 w-2 rounded-full" style={{ background: v ? color : "#e7e9ee", opacity: v === max && v ? 1 : 0.45, animationDelay: `${i * 20 + d * 30}ms` }} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function TickBar({ used, total, color = "#2f6bff", ticks = 60 }: { used: number; total: number; color?: string; ticks?: number }) {
  const filled = total ? Math.round((used / total) * ticks) : 0;
  return (
    <div className="flex h-7 gap-[2px]">
      {Array.from({ length: ticks }).map((_, i) => (
        <i key={i} className="g-grow-y block flex-1 rounded-[2px]" style={{ background: i < filled ? color : "#e7e9ee", animationDelay: `${i * 12}ms` }} />
      ))}
    </div>
  );
}

export function SegmentBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <>
      <div className="flex h-4 gap-1">
        {parts.filter((p) => p.value > 0).map((p) => <div key={p.label} className="hatch g-grow-x rounded-md" style={{ width: `${(p.value / total) * 100}%`, ["--c" as string]: p.color }} />)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {parts.map((p) => <div key={p.label} className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} /><span className="truncate text-ink-2">{p.label}</span><b className="ml-auto">{p.value}</b></div>)}
      </div>
    </>
  );
}

export function StepArea({ values, color = "#f062a8" }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values), w = 300, h = 110, n = Math.max(1, values.length);
  const pts = values.flatMap((v, i) => { const y = h - (v / max) * (h - 8) - 2; return [[(i / n) * w, y], [((i + 1) / n) * w, y]]; });
  const line = pts.map((p) => p.join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="Activity over time">
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={color} opacity=".14" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}
