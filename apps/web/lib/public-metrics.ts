import "server-only";
import type { MetricValue } from "@henseng/core";

export interface PublicMetric {
  label: string;
  environment: "MAINNET" | "TESTNET";
  value: MetricValue;
  /** How the number will be produced once available */
  method: string;
}

/**
 * Public metrics. Each is computed from stored, verified records. Until the
 * indexer and transaction tables exist (Phase 2+), every metric reports
 * "unavailable" with the reason — never a placeholder number.
 */
export async function getPublicMetrics(): Promise<PublicMetric[]> {
  const notYet = (reason: string): MetricValue => ({ status: "unavailable", reason });
  return [
    {
      label: "Successful swaps",
      environment: "MAINNET",
      value: notYet("Mainnet swaps launch in Phase 3."),
      method: "Swaps with a confirmed on-chain receipt (status 1) and matching transfer events.",
    },
    {
      label: "Swap volume (USD)",
      environment: "MAINNET",
      value: notYet("Mainnet swaps launch in Phase 3."),
      method: "Sum of input value at execution time, only where a reliable price source exists.",
    },
    {
      label: "Completed bridges",
      environment: "MAINNET",
      value: notYet("Bridging launches in Phase 3."),
      method: "Counted only after the destination-chain transaction is confirmed.",
    },
    {
      label: "Protocol fees collected",
      environment: "MAINNET",
      value: notYet("No fees are collected before mainnet launch."),
      method: "Fee transfers to the HENSENG fee wallet, reconciled with provider records. Not the same as volume.",
    },
    {
      label: "Unique active wallets (30 days)",
      environment: "MAINNET",
      value: notYet("No transactions have been recorded yet."),
      method: "Wallets with at least one successful swap or bridge in the period. Connecting a wallet alone does not count.",
    },
    {
      label: "Testnet swaps",
      environment: "TESTNET",
      value: notYet("Testnet swaps launch in Phase 2."),
      method: "Reported separately. Testnet activity has no monetary value and is never added to mainnet figures.",
    },
  ];
}
