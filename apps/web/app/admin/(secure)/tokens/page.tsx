import { hasPermission } from "@henseng/core";
import { getDb } from "@henseng/db";
import { Badge } from "@/components/ui";
import { AddTokenForm } from "@/components/admin/add-token-form";
import { TokenActions } from "@/components/admin/token-actions";
import { requireAdminPage } from "@/lib/admin";

const statusTone = { VERIFIED: "live", PENDING_REVIEW: "warn", UNVERIFIED: "neutral", REJECTED: "danger" } as const;

export default async function AdminTokens() {
  const admin = await requireAdminPage();
  const canWrite = hasPermission(admin.adminRoles, "registry.tokens.write");
  const db = getDb();
  const [tokens, chains] = await Promise.all([
    db.token.findMany({ orderBy: [{ chainId: "asc" }, { symbol: "asc" }], include: { chain: true } }),
    db.chain.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Token registry</h1>
      <p className="mt-3 max-w-[70ch] text-sm text-ink-muted">
        New tokens start as pending review and turned off. When you add a token, HENSENG reads its decimals and symbol from the
        contract and flags anything that impersonates a verified symbol. A token must be verified before it can be turned on.
      </p>

      {canWrite && <AddTokenForm chains={chains} />}

      <div className="mt-10 overflow-x-auto rounded-[var(--radius-panel)] border border-rule">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-deep text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Token</th>
              <th scope="col" className="px-4 py-3 font-medium">Chain</th>
              <th scope="col" className="px-4 py-3 font-medium">Address</th>
              <th scope="col" className="px-4 py-3 font-medium">Decimals</th>
              <th scope="col" className="px-4 py-3 font-medium">Review</th>
              <th scope="col" className="px-4 py-3 font-medium">Risk flags</th>
              <th scope="col" className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {tokens.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">No tokens yet. Add the first one above.</td>
              </tr>
            )}
            {tokens.map((t) => (
              <tr key={t.id}>
                <th scope="row" className="px-4 py-3 font-medium">
                  {t.symbol}
                  <span className="block text-xs font-normal text-ink-faint">{t.name}</span>
                </th>
                <td className="px-4 py-3 text-ink-muted">{t.chain.name}</td>
                <td className="tabular px-4 py-3 text-xs text-ink-muted">
                  <a href={`${t.chain.explorerUrl}/address/${t.address}`} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                    {t.address.slice(0, 10)}…{t.address.slice(-6)}
                  </a>
                </td>
                <td className="tabular px-4 py-3 text-ink-muted">{t.decimals}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone[t.verificationStatus]}>{t.verificationStatus.replace("_", " ").toLowerCase()}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">{t.riskFlags.join(", ").toLowerCase().replaceAll("_", " ") || "None"}</td>
                <td className="px-4 py-3">
                  <TokenActions id={t.id} status={t.verificationStatus} enabled={t.enabled} disabled={!canWrite} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
