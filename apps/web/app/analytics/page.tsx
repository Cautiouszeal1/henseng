import type { Metadata } from "next";
import { formatMetric } from "@henseng/core";
import { Badge } from "@/components/ui";
import { getPublicMetrics } from "@/lib/public-metrics";

export const metadata: Metadata = { title: "Public analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const metrics = await getPublicMetrics();
  const groups = [
    { env: "MAINNET" as const, title: "Mainnet" },
    { env: "TESTNET" as const, title: "Testnet" },
  ];
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Public analytics</h1>
      <p className="mt-4 max-w-[66ch] text-ink-muted">
        Counted from confirmed on-chain records and HENSENG&apos;s own transaction logs. Failed or reverted transactions are never counted
        as successful, and testnet figures are never added to mainnet figures. Each metric below shows how it is calculated.
      </p>

      {groups.map((g) => (
        <section key={g.env} className="mt-14" aria-labelledby={`h-${g.env}`}>
          <h2 id={`h-${g.env}`} className="flex items-center gap-3 text-xl font-semibold">
            {g.title}
            <Badge tone={g.env === "MAINNET" ? "mainnet" : "testnet"}>{g.env === "MAINNET" ? "Real assets" : "No monetary value"}</Badge>
          </h2>
          <dl className="mt-6 divide-y divide-rule border-y border-rule">
            {metrics
              .filter((m) => m.environment === g.env)
              .map((m) => (
                <div key={m.label} className="grid gap-2 py-6 md:grid-cols-[16rem_14rem_1fr] md:gap-8">
                  <dt className="font-medium">{m.label}</dt>
                  <dd className="tabular text-ink-muted">
                    {formatMetric(m.value)}
                    {m.value.status === "unavailable" && <span className="block text-xs text-ink-faint">{m.value.reason}</span>}
                  </dd>
                  <dd className="max-w-[60ch] text-sm text-ink-faint">{m.method}</dd>
                </div>
              ))}
          </dl>
        </section>
      ))}

      <p className="mt-12 text-sm text-ink-faint">
        CSV and PDF exports, custom date ranges and per-network breakdowns will be added in Phase 5, once there is data to export.
      </p>
    </div>
  );
}
