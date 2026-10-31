"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-ghost text-base"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/demo", { method: "POST" });
        const { slug } = await res.json();
        router.push(`/dashboard/${slug}`);
      }}
    >
      {busy ? "Opening the bakery…" : "🥐 Open the demo bakery"}
    </button>
  );
}
