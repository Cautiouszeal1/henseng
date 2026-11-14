import { getDb } from "@henseng/db";
import { requireAdminPage } from "@/lib/admin";

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  await requireAdminPage();
  const { denied } = await searchParams;
  const db = getDb();
  const [chains, enabledChains, tokens, pendingTokens, admins, wallets] = await Promise.all([
    db.chain.count(),
    db.chain.count({ where: { enabled: true } }),
    db.token.count(),
    db.token.count({ where: { verificationStatus: { in: ["UNVERIFIED", "PENDING_REVIEW"] } } }),
    db.adminUser.count({ where: { disabledAt: null } }),
    db.wallet.count(),
  ]);
  const stats = [
    ["Chains in registry", chains],
    ["Chains enabled", enabledChains],
    ["Tokens in registry", tokens],
    ["Tokens awaiting review", pendingTokens],
    ["Signed-in wallets", wallets],
    ["Active admins", admins],
  ] as const;
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Admin overview</h1>
      {denied && (
        <p role="alert" className="mt-4 text-sm text-danger">Your role does not include access to that page.</p>
      )}
      <dl className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-deep p-6">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="tabular mt-2 text-3xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-sm text-ink-faint">Counts come straight from the database. Trading, revenue and campaign metrics appear once those features exist.</p>
    </div>
  );
}
