import Link from "next/link";
import { useId } from "react";

export function Logo({ size = 28 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={id} x1="6" y1="4" x2="60" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2f6bff" /><stop offset="1" stopColor="#7b3ff2" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id})`} />
      <path d="M35 15H25.5a8.5 8.5 0 0 0 0 17h13a8.5 8.5 0 0 1 0 17H17" fill="none" stroke="#fff" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="48" cy="15" r="5.5" fill="#ffb35c" />
    </svg>
  );
}

export function Nav({ children }: { children?: React.ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
      <Link href="/" className="flex items-center gap-2.5">
        <Logo />
        <span className="text-lg font-semibold tracking-tight">Shelfie Street</span>
      </Link>
      <nav className="flex items-center gap-2 text-sm">{children}</nav>
    </header>
  );
}
