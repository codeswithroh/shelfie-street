import Link from "next/link";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="15" fill="#0f1218" />
      <path d="M22 11h31L43 23H12z" fill="#fff" />
      <path d="M12 23h17l23 18H35z" fill="#7da2ff" />
      <path d="M42 53H11l10-12h31z" fill="#fff" />
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
