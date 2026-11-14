import type { Environment } from "./environment";

/**
 * HENSENG fee engine (spec §16).
 *
 * All arithmetic is done in integer base units (bigint) so that the quote shown
 * to the user and the fee recorded afterwards are identical. Rates are expressed
 * in basis points with up to two decimal places, stored as "centi-bps"
 * (1 bps = 100 centi-bps) to avoid floating point.
 *
 * Fee configurations are resolved by specificity. The most specific matching,
 * active configuration wins:
 *   provider+chain+token > chain+token > provider+chain > chain > provider > global
 */

export type FeeProduct = "SWAP" | "BRIDGE";

export interface FeeConfiguration {
  id: string;
  version: number;
  product: FeeProduct;
  environment: Environment;
  /** null = applies to any chain */
  chainId: number | null;
  /** lower-cased token address; null = any token */
  tokenAddress: string | null;
  /** provider slug; null = any provider */
  providerId: string | null;
  /** rate in centi-bps: 30 bps = 3000 */
  rateCentiBps: number;
  /** optional bounds, in base units of the fee token */
  minFee: bigint | null;
  maxFee: bigint | null;
  enabled: boolean;
  activeFrom: Date;
  activeTo: Date | null;
}

export interface FeeContext {
  product: FeeProduct;
  environment: Environment;
  chainId: number;
  tokenAddress: string;
  providerId: string;
  at?: Date;
}

export interface FeeQuote {
  configurationId: string | null;
  configurationVersion: number | null;
  rateCentiBps: number;
  feeAmount: bigint;
  amountAfterFee: bigint;
  /** true when no configuration matched or fees are disabled for this context */
  noFee: boolean;
}

/** Hard ceiling so a misconfigured row can never charge more than 5%. */
export const MAX_RATE_CENTI_BPS = 50_000;

const CENTI_BPS_DENOMINATOR = 1_000_000n; // 100% = 10_000 bps = 1_000_000 centi-bps

export function bpsToCentiBps(bps: number): number {
  const v = Math.round(bps * 100);
  if (!Number.isFinite(v) || v < 0) throw new Error(`Invalid bps: ${bps}`);
  return v;
}

function specificity(c: FeeConfiguration): number {
  return (c.providerId ? 1 : 0) + (c.chainId !== null ? 2 : 0) + (c.tokenAddress ? 4 : 0);
}

function matches(c: FeeConfiguration, ctx: FeeContext, at: Date): boolean {
  if (!c.enabled) return false;
  if (c.product !== ctx.product) return false;
  if (c.environment !== ctx.environment) return false;
  if (c.chainId !== null && c.chainId !== ctx.chainId) return false;
  if (c.tokenAddress && c.tokenAddress.toLowerCase() !== ctx.tokenAddress.toLowerCase()) return false;
  if (c.providerId && c.providerId !== ctx.providerId) return false;
  if (c.activeFrom > at) return false;
  if (c.activeTo && c.activeTo <= at) return false;
  return true;
}

export function resolveFeeConfiguration(
  configs: readonly FeeConfiguration[],
  ctx: FeeContext,
): FeeConfiguration | null {
  const at = ctx.at ?? new Date();
  const candidates = configs.filter((c) => matches(c, ctx, at));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const s = specificity(b) - specificity(a);
    if (s !== 0) return s;
    // Same specificity: newest version wins (deterministic).
    if (b.version !== a.version) return b.version - a.version;
    return b.activeFrom.getTime() - a.activeFrom.getTime();
  });
  return candidates[0] ?? null;
}

export function calculateFee(amount: bigint, config: FeeConfiguration | null): FeeQuote {
  if (amount < 0n) throw new Error("Amount must be non-negative");
  if (!config || config.rateCentiBps === 0) {
    return {
      configurationId: config?.id ?? null,
      configurationVersion: config?.version ?? null,
      rateCentiBps: 0,
      feeAmount: 0n,
      amountAfterFee: amount,
      noFee: true,
    };
  }
  if (config.rateCentiBps < 0 || config.rateCentiBps > MAX_RATE_CENTI_BPS) {
    throw new Error(`Fee rate ${config.rateCentiBps} centi-bps is outside the allowed range`);
  }
  // Round down so the user is never charged more than the advertised rate.
  let fee = (amount * BigInt(config.rateCentiBps)) / CENTI_BPS_DENOMINATOR;
  if (config.minFee !== null && fee < config.minFee) fee = config.minFee;
  if (config.maxFee !== null && fee > config.maxFee) fee = config.maxFee;
  if (fee > amount) fee = amount;
  return {
    configurationId: config.id,
    configurationVersion: config.version,
    rateCentiBps: config.rateCentiBps,
    feeAmount: fee,
    amountAfterFee: amount - fee,
    noFee: false,
  };
}

export function quoteFee(
  configs: readonly FeeConfiguration[],
  ctx: FeeContext,
  amount: bigint,
): FeeQuote {
  return calculateFee(amount, resolveFeeConfiguration(configs, ctx));
}

/** Formats centi-bps as a human percentage string, e.g. 3000 → "0.30%". */
export function formatRate(rateCentiBps: number): string {
  return `${(rateCentiBps / 10_000).toFixed(2)}%`;
}
