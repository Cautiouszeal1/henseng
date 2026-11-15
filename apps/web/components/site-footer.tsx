import Link from "next/link";
import { Logo } from "./logo";

const groups = [
  {
    title: "Product",
    links: [
      { href: "/swap", label: "Swap" },
      { href: "/bridge", label: "Bridge" },
      { href: "/chains", label: "Supported chains" },
      { href: "/airdrops", label: "Airdrop Hub" },
    ],
  },
  {
    title: "Transparency",
    links: [
      { href: "/analytics", label: "Public analytics" },
      { href: "/docs/fees", label: "Fees" },
      { href: "/docs/security", label: "Security" },
      { href: "/privacy", label: "Privacy policy" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/docs/getting-started", label: "Getting started" },
      { href: "/docs/hxp", label: "HXP points" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-[38ch] text-sm text-ink-muted">
            Non-custodial. You keep your keys and sign every transaction yourself. HENSENG never asks for your seed phrase.
          </p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="text-sm font-medium text-ink">{g.title}</h2>
            <ul className="mt-4 space-y-3">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-ink-muted hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-7xl px-6 pb-10 text-xs leading-relaxed text-ink-faint">
        <p className="max-w-[90ch]">
          HENSENG has not been independently audited. Using decentralised finance involves risk, including loss of funds. HXP are
          platform points with no monetary value and are not a token. Taking part in any campaign does not guarantee an airdrop.
        </p>
        <p className="mt-3">© {new Date().getFullYear()} HENSENG</p>
      </div>
    </footer>
  );
}
