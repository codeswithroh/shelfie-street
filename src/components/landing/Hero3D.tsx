"use client";

import { useEffect, useRef } from "react";

type Dot = { x: number; y: number; a: number };

// Samples an emoji into a dot matrix, so each hand is drawn as moving dots.
function sampleHand(emoji: string, size: number, cell: number): Dot[] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.font = `${size * 0.82}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(emoji, size / 2, size / 2);
  const { data } = g.getImageData(0, 0, size, size);
  const dots: Dot[] = [];
  for (let y = 0; y < size; y += cell) for (let x = 0; x < size; x += cell) {
    const i = (y * size + x) * 4;
    if (data[i + 3] < 90) continue;
    dots.push({ x: x - size / 2, y: y - size / 2, a: (data[i] + data[i + 1] + data[i + 2]) / 765 });
  }
  return dots;
}

const ARMS: [number, number, number][] = [[0, 0, 0]];
for (let i = 1; i <= 3; i++) ARMS.push([i, 0, 0], [-i, 0, 0], [0, i, 0], [0, -i, 0], [0, 0, i], [0, 0, -i]);
for (const [x, y, z] of [[1, 1, 0], [-1, -1, 0], [1, -1, 0], [-1, 1, 0]] as const) ARMS.push([x, y, z]);

const FACES = [
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
  { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
];

export function Hero3D() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, mx = 0, my = 0;
    let left: Dot[] = [], right: Dot[] = [];
    const cell = 8;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (w < 40) return;
      const size = Math.round(Math.min(w * 0.48, 460));
      left = sampleHand("👉", size, cell);
      right = sampleHand("👈", size, cell);
    };
    const onMove = (e: PointerEvent) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };

    const drawHand = (dots: Dot[], cx: number, cy: number, t: number, warm: boolean) => {
      for (const d of dots) {
        const wave = Math.sin(t * 2 + d.x * 0.018 + d.y * 0.012);
        const r = (cell / 2) * (0.5 + d.a * 0.45) * (0.82 + 0.18 * wave);
        const l = 0.35 + d.a * 0.6 + wave * 0.08;
        ctx.fillStyle = warm ? `rgb(${235 * l + 20},${165 * l + 10},${130 * l})` : `rgb(${215 * l},${218 * l},${225 * l})`;
        ctx.beginPath();
        ctx.arc(cx + d.x + wave * 1.5, cy + d.y, Math.max(r, 0.5), 0, 6.3);
        ctx.fill();
      }
    };

    const drawCore = (cx: number, cy: number, s: number, t: number) => {
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 11);
      glow.addColorStop(0, `rgba(255,150,90,${0.33 + Math.sin(t * 2) * 0.08})`);
      glow.addColorStop(0.4, "rgba(120,80,255,.16)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - s * 12, cy - s * 12, s * 24, s * 24);

      const ry = t * 0.6 + mx * 1.2, rx = 0.5 + Math.sin(t * 0.4) * 0.3 + my;
      const [cy1, sy1, cx1, sx1] = [Math.cos(ry), Math.sin(ry), Math.cos(rx), Math.sin(rx)];
      const rot = ([x, y, z]: number[]) => {
        const x1 = x * cy1 + z * sy1, z1 = -x * sy1 + z * cy1;
        return [x1, y * cx1 - z1 * sx1, y * sx1 + z1 * cx1];
      };
      const polys: { pts: number[][]; z: number; light: number }[] = [];
      for (const c of ARMS) {
        for (const f of FACES) {
          const n = rot(f.n);
          if (n[2] < 0) continue;
          const pts = f.v.map((v) => {
            const p = rot([c[0] * 2 + v[0] * 0.92, c[1] * 2 + v[1] * 0.92, c[2] * 2 + v[2] * 0.92]);
            const k = 26 / (26 - p[2]);
            return [cx + p[0] * s * k, cy + p[1] * s * k, p[2]];
          });
          polys.push({ pts, z: pts.reduce((a, p) => a + p[2], 0), light: n[2] * 0.7 + n[1] * -0.3 + 0.3 });
        }
      }
      polys.sort((a, b) => a.z - b.z);
      for (const p of polys) {
        const g = ctx.createLinearGradient(p.pts[0][0], p.pts[0][1], p.pts[2][0], p.pts[2][1]);
        const l = Math.max(0.25, Math.min(1, p.light));
        g.addColorStop(0, `rgb(${110 * l + 30},${70 * l + 15},${255 * l})`);
        g.addColorStop(1, `rgb(${255 * l},${135 * l},${95 * l + 40})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        p.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.closePath();
        ctx.fill();
      }
    };

    const frame = (ms: number) => {
      const t = still ? 2 : ms / 1000;
      ctx.clearRect(0, 0, w, h);
      const narrow = w < 700;
      const handY = h * (narrow ? 0.72 : 0.62);
      const reach = Math.sin(t * 0.8) * 16;
      drawHand(left, w * (narrow ? 0.16 : 0.2) + reach + mx * 24, handY - 26 + my * 14, t, false);
      drawHand(right, w * (narrow ? 0.84 : 0.8) - reach + mx * 24, handY + 46 + my * 14, t + 1.5, true);
      drawCore(w / 2, h * (narrow ? 0.66 : 0.68), Math.min(w, h) * 0.022, t);
      if (!still) raf = requestAnimationFrame(frame);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); removeEventListener("pointermove", onMove); };
  }, []);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}
