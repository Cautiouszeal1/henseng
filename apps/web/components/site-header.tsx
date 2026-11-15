"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { WalletButton } from "./wallet-button";
import { useSession } from "./session-context";
import { Logo } from "./logo";

/** `live: false` items open an honest "not available yet" page. */
export const NAV = [
  { href: "/swap", label: "Swap", live: false },
  { href: "/bridge", label: "Bridge", live: false },
  { href: "/chains", label: "Chains", live: true },
  { href: "/airdrops", label: "Airdrop Hub", live: false },
  { href: "/campaigns", label: "Campaigns", live: false },
  { href: "/leaderboard", label: "Leaderboard", live: false },
  { href: "/analytics", label: "Analytics", live: true },
  { href: "/docs", label: "Docs", live: true },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { session } = useSession();
  const isAdmin = session.status === "signed-in" && session.isAdmin;

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-abyss/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="HENSENG home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "rounded-[var(--radius-control)] px-3 py-2 text-sm transition-colors",
                pathname.startsWith(item.href) ? "text-ink" : "text-ink-muted hover:text-ink",
              )}
            >
              {item.label}
              {!item.live && <span className="ml-1.5 text-[11px] text-ink-faint">soon</span>}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" className="ml-2 rounded-[var(--radius-control)] px-3 py-2 text-sm text-warn hover:bg-deeper">
              Admin
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <a href="/app" className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-volt px-4 text-sm font-medium text-white hover:bg-volt-hover">
            Open app
          </a>
          <WalletButton />
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-deeper lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-rule px-6 py-3 lg:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between py-3 text-ink-muted hover:text-ink"
            >
              {item.label}
              {!item.live && <span className="text-xs text-ink-faint">Coming soon</span>}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" onClick={() => setOpen(false)} className="block py-3 text-warn">
              Admin
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
