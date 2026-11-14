import { hasPermission } from "@henseng/core";
import { getDb } from "@henseng/db";
import { Badge } from "@/components/ui";
import { ChainToggle } from "@/components/admin/chain-toggle";
import { requireAdminPage } from "@/lib/admin";

export default async function AdminChains() {
  const admin = await requireAdminPage();
  const canWrite = hasPermission(admin.adminRoles, "registry.chains.write");
  const chains = await getDb().chain.findMany({
    orderBy: [{ environment: "desc" }, { id: "asc" }],
    include: { providers: { include: { provider: true } } },
  });
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Chains</h1>
      <p className="mt-3 max-w-[70ch] text-sm text-ink-muted">
        Turning a chain on does not make it live by itself. A chain shows as live publicly only when it is turned on <em>and</em> at least
        one provider integration on it is turned on and has passed verification. Provider verification arrives with Phase 2.
      </p>
      <div className="mt-8 overflow-x-auto rounded-[var(--radius-panel)] border border-rule">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-deep text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Chain</th>
              <th scope="col" className="px-4 py-3 font-medium">ID</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Provider candidates</th>
              <th scope="col" className="px-4 py-3 font-medium">Health</th>
              <th scope="col" className="px-4 py-3 font-medium">Enabled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {chains.map((c) => (
              <tr key={c.id}>
                <th scope="row" className="px-4 py-3 font-medium">{c.name}</th>
                <td className="tabular px-4 py-3 text-ink-muted">{c.id}</td>
                <td className="px-4 py-3">
                  <Badge tone={c.environment === "MAINNET" ? "mainnet" : "testnet"}>{c.environment.toLowerCase()}</Badge>
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {c.providers.map((p) => `${p.provider.name}${p.verifiedAt ? " (verified)" : ""}`).join(", ") || "None"}
                </td>
                <td className="px-4 py-3 text-ink-muted">{c.healthStatus.toLowerCase()}</td>
                <td className="px-4 py-3">
                  <ChainToggle chainId={c.id} name={c.name} enabled={c.enabled} disabled={!canWrite} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
