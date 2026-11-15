import Link from "next/link";
import { formatMetric } from "@henseng/core";
import { Badge, ButtonAnchor, ButtonLink } from "@/components/ui";
import { RouteMap } from "@/components/route-map";
import { listChains } from "@/lib/registry";
import { getPublicMetrics } from "@/lib/public-metrics";

export const dynamic = "force-dynamic";

const products = [
  {
    name: "Swap",
    href: "/swap",
    body: "Trade tokens on the same network. Quotes come from established aggregators, and every fee is shown before you sign.",
    status: "Testnet in Phase 2, mainnet in Phase 3",
  },
  {
    name: "Bridge",
    href: "/bridge",
    body: "Move assets between networks. A bridge only shows as complete once the destination transaction is confirmed.",
    status: "Phase 3",
  },
  {
    name: "Airdrop Hub",
    href: "/airdrops",
    body: "Campaigns from official project sources, each with its last-verified date and risk warnings. No guaranteed rewards.",
    status: "Phase 4",
  },
  {
    name: "HXP points",
    href: "/docs/hxp",
    body: "Points for genuine activity, kept in an append-only ledger. HXP has no monetary value and is not a token.",
    status: "Phase 4",
  },
];

const commitments = [
  ["You sign everything", "HENSENG never holds your funds. Every approval and transaction is signed in your own wallet."],
  ["No seed phrases, ever", "HENSENG will never ask for your seed phrase or private key. Anyone who does is not us."],
  ["Fees before you confirm", "Network gas, provider fees and the HENSENG fee are listed separately, along with the amount you receive."],
  ["Exact approvals", "Token approvals are for the amount you are trading, not unlimited, unless you choose otherwise."],
  ["Honest numbers", "Public figures come from confirmed on-chain records. When we have no data, we say so."],
  ["Not audited yet", "HENSENG has not had an independent audit. We will say so until one is completed and published."],
] as const;

const faqs = [
  ["Which networks can I use today?", "None are live yet. Ethereum, Base and Arbitrum (mainnet) and Sepolia and Base Sepolia (testnet) are in the registry. Each one goes live only after its swap or bridge integration has been tested. The Chains page always shows the current status."],
  ["Is HENSENG custodial?", "No. Your wallet stays yours. HENSENG prepares transactions, and you review and sign them in your wallet."],
  ["What is the difference between testnet and mainnet mode?", "Testnet mode uses test networks and test tokens with no real value, so you can learn and test safely. Mainnet mode uses real assets. Activity, fees and points from the two are never combined."],
  ["Will using HENSENG get me an airdrop?", "No one can promise that. The Airdrop Hub lists campaigns from official sources, but projects decide who receives anything."],
  ["What does HENSENG charge?", "A protocol fee on mainnet swaps and bridges, shown as its own line before you confirm. The rate will be published on the Fees page before launch."],
] as const;

export default async function HomePage() {
  const [registry, metrics] = await Promise.all([listChains(), getPublicMetrics()]);

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-16 md:pt-24 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <h1 className="text-[length:var(--text-display)] font-semibold leading-[var(--text-display--line-height)] tracking-[var(--text-display--letter-spacing)]">
            <span className="block">Swap.</span>
            <span className="block">Bridge.</span>
            <span className="block text-ink-muted">Explore.</span>
            <span className="block text-ink-faint">Earn.</span>
          </h1>
          <p className="mt-8 max-w-[44ch] text-lg text-ink-muted">
            One destination for cross-chain swaps, seamless bridging, testnet exploration and Web3 rewards.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonAnchor href="/app" className="h-12 px-6 text-[15px]">Open HENSENG</ButtonAnchor>
            <ButtonLink href="/airdrops" variant="secondary" className="h-12 px-6 text-[15px]">Explore Airdrops</ButtonLink>
          </div>
          <p className="mt-6 text-sm text-ink-faint">
            The HENSENG app (wallet, encrypted chat, swaps and bridging) runs in your browser at /app and on iPhone and Android. The swap and bridge pages on this site are not live yet.
          </p>
        </div>
        <RouteMap registry={registry} />
      </section>

      {/* Modes */}
      <section className="border-y border-rule bg-deep/40">
        <div className="mx-auto grid max-w-7xl md:grid-cols-2">
          <div className="border-rule px-6 py-14 md:border-r md:pr-12">
            <Badge tone="testnet">Testnet mode</Badge>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight">Practise with test tokens</h2>
            <p className="mt-3 max-w-[52ch] text-ink-muted">
              Try swaps and bridges on Sepolia and Base Sepolia using test tokens from faucets. They have no real value, so
              mistakes cost nothing. Testnet fees are only there to test the fee mechanics, and they are never counted as revenue.
            </p>
          </div>
          <div className="border-t border-rule px-6 py-14 md:border-t-0 md:pl-12">
            <Badge tone="mainnet">Mainnet mode</Badge>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight">Trade real assets</h2>
            <p className="mt-3 max-w-[52ch] text-ink-muted">
              Swap and bridge on Ethereum, Base and Arbitrum through established aggregators. You see the route, price impact,
              minimum received and every fee before you sign. Mainnet figures are always reported separately from testnet.
            </p>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="max-w-[24ch] text-3xl font-semibold tracking-tight md:text-4xl">What you will be able to do</h2>
        <ul className="mt-12 divide-y divide-rule border-y border-rule">
          {products.map((p) => (
            <li key={p.name}>
              <Link href={p.href} className="group grid gap-3 py-7 md:grid-cols-[14rem_1fr_auto] md:items-baseline md:gap-10">
                <span className="text-xl font-medium group-hover:text-volt-hover">{p.name}</span>
                <span className="max-w-[62ch] text-ink-muted">{p.body}</span>
                <span className="text-sm text-ink-faint">{p.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Transparency */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Public numbers, from the chain</h2>
            <p className="mt-3 max-w-[60ch] text-ink-muted">
              Every figure here is counted from confirmed transactions you can check on a block explorer. Volume and protocol revenue are
              reported separately.
            </p>
          </div>
          <ButtonLink href="/analytics" variant="secondary">Open analytics</ButtonLink>
        </div>
        <div className="mt-10 overflow-x-auto rounded-[var(--radius-panel)] border border-rule">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Public platform metrics</caption>
            <thead className="bg-deep text-ink-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Metric</th>
                <th scope="col" className="px-5 py-3 font-medium">Network</th>
                <th scope="col" className="px-5 py-3 font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {metrics.map((m) => (
                <tr key={m.label}>
                  <th scope="row" className="px-5 py-4 font-normal text-ink">{m.label}</th>
                  <td className="px-5 py-4">
                    <Badge tone={m.environment === "MAINNET" ? "mainnet" : "testnet"}>{m.environment === "MAINNET" ? "Mainnet" : "Testnet"}</Badge>
                  </td>
                  <td className="tabular px-5 py-4 text-ink-muted">
                    {formatMetric(m.value)}
                    {m.value.status === "unavailable" && <span className="block text-xs text-ink-faint">{m.value.reason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Security */}
      <section className="border-t border-rule">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <h2 className="max-w-[22ch] text-3xl font-semibold tracking-tight md:text-4xl">Your keys stay yours</h2>
          <dl className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {commitments.map(([t, d]) => (
              <div key={t} className="border-l-2 border-rule-strong pl-5">
                <dt className="font-medium">{t}</dt>
                <dd className="mt-2 text-sm text-ink-muted">{d}</dd>
              </div>
            ))}
          </dl>
          <Link href="/docs/security" className="mt-12 inline-block text-sm text-volt-hover underline-offset-4 hover:underline">
            Read the security guide
          </Link>
        </div>
      </section>

      {/* Partners */}
      <section className="border-t border-rule bg-deep/40">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-20 md:grid-cols-[1fr_1.2fr] md:items-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">For projects and partners</h2>
          <p className="max-w-[60ch] text-ink-muted">
            Projects will be able to submit campaigns, set tasks and rewards, and see verified participation. Partner applications open
            with the Campaigns release. Until then, we list no partners: anyone shown here will be someone we actually work with.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-6 py-24">
        <h2 className="text-3xl font-semibold tracking-tight">Questions</h2>
        <div className="mt-10 divide-y divide-rule border-y border-rule">
          {faqs.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-medium">
                {q}
                <span aria-hidden className="text-ink-faint transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-[68ch] text-ink-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
