import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";

export const metadata: Metadata = { robots: { index: false } };
export const dynamic = "force-dynamic";

const sections = [
  { href: "/admin", label: "Overview", live: true },
  { href: "/admin/chains", label: "Chains", live: true },
  { href: "/admin/tokens", label: "Token registry", live: true },
  { href: "/admin/audit", label: "Audit log", live: true },
  { label: "Swap and bridge providers", live: false },
  { label: "Fee configuration", live: false },
  { label: "Campaigns and airdrops", live: false },
  { label: "Rewards and referrals", live: false },
  { label: "Users and roles", live: false },
  { label: "Risk monitoring", live: false },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[15rem_1fr]">
      <aside>
        <p className="text-sm text-ink-faint">Signed in as</p>
        <p className="tabular mt-1 truncate text-sm">{admin.address}</p>
        <p className="mt-1 text-xs text-warn">{admin.adminRoles.join(", ").replaceAll("_", " ").toLowerCase()}</p>
        <nav aria-label="Admin" className="mt-8 space-y-1 text-sm">
          {sections.map((s) =>
            s.live ? (
              <Link key={s.label} href={s.href} className="block rounded-[var(--radius-control)] px-3 py-2 text-ink-muted hover:bg-deeper hover:text-ink">
                {s.label}
              </Link>
            ) : (
              <span key={s.label} className="flex items-center justify-between px-3 py-2 text-ink-faint" aria-disabled>
                {s.label}
                <span className="text-[11px]">soon</span>
              </span>
            ),
          )}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
