import Link from "next/link";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x="2" y="2" width="28" height="28" rx="8" fill="#1d1b17" />
      <rect x="7" y="19" width="18" height="2.4" rx="1" fill="#f5f0e6" />
      <rect x="9" y="11" width="4" height="8" rx="1" fill="#f3d98b" />
      <rect x="14.5" y="13" width="4" height="6" rx="1" fill="#e0532f" />
      <path d="M20 12.5h4.5l1.5 2-1.5 2H20z" fill="#f5f0e6" />
    </svg>
  );
}

export function Nav({ children }: { children?: React.ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
      <Link href="/" className="flex items-center gap-2.5">
        <Logo />
        <span className="font-display text-2xl leading-none">Shelfie</span>
      </Link>
      <nav className="flex items-center gap-2 text-sm">{children}</nav>
    </header>
  );
}
