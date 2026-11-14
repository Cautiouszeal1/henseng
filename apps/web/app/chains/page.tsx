import type { Metadata } from "next";
import { Badge } from "@/components/ui";
import { listChains } from "@/lib/registry";

export const metadata: Metadata = { title: "Supported chains" };
export const dynamic = "force-dynamic";

export default async function ChainsPage() {
  const registry = await listChains();
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Chains</h1>
      <p className="mt-4 max-w-[64ch] text-ink-muted">
        A network shows as live only after HENSENG has an enabled, tested swap or bridge integration on it. Networks that are listed
        but not live are on the roadmap. You cannot transact on them through HENSENG yet.
      </p>

      {registry.status !== "ok" ? (
        <p role="status" className="mt-10 rounded-[var(--radius-panel)] border border-warn/40 bg-warn/5 p-5 text-warn">
          {registry.reason} Chain status cannot be shown right now.
        </p>
      ) : registry.chains.length === 0 ? (
        <p className="mt-10 text-ink-muted">No networks have been added to the registry yet.</p>
      ) : (
        <div className="mt-10 overflow-x-auto rounded-[var(--radius-panel)] border border-rule">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-deep text-ink-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Network</th>
                <th scope="col" className="px-5 py-3 font-medium">Type</th>
                <th scope="col" className="px-5 py-3 font-medium">Chain ID</th>
                <th scope="col" className="px-5 py-3 font-medium">Swap</th>
                <th scope="col" className="px-5 py-3 font-medium">Bridge</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {registry.chains.map((c) => (
                <tr key={c.id}>
                  <th scope="row" className="px-5 py-4 font-medium">
                    <a href={c.explorerUrl} target="_blank" rel="noopener noreferrer" className="hover:text-volt-hover">
                      {c.name}
                    </a>
                  </th>
                  <td className="px-5 py-4">
                    <Badge tone={c.environment === "MAINNET" ? "mainnet" : "testnet"}>{c.environment === "MAINNET" ? "Mainnet" : "Testnet"}</Badge>
                  </td>
                  <td className="tabular px-5 py-4 text-ink-muted">{c.id}</td>
                  <td className="px-5 py-4 text-ink-muted">{c.swapProviders.join(", ") || "None yet"}</td>
                  <td className="px-5 py-4 text-ink-muted">{c.bridgeProviders.join(", ") || "None yet"}</td>
                  <td className="px-5 py-4">{c.supported ? <Badge tone="live">Live</Badge> : <Badge>Not live yet</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-6 text-sm text-ink-faint">Solana and other non-EVM networks will be added later. They are not supported today.</p>
    </div>
  );
}
