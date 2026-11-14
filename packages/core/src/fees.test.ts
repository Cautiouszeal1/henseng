import { describe, expect, it } from "vitest";
import { bpsToCentiBps, calculateFee, formatRate, quoteFee, resolveFeeConfiguration, type FeeConfiguration } from "./fees";

const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const base = (over: Partial<FeeConfiguration>): FeeConfiguration => ({
  id: "cfg",
  version: 1,
  product: "SWAP",
  environment: "MAINNET",
  chainId: null,
  tokenAddress: null,
  providerId: null,
  rateCentiBps: 3000,
  minFee: null,
  maxFee: null,
  enabled: true,
  activeFrom: new Date("2026-01-01"),
  activeTo: null,
  ...over,
});
const ctx = {
  product: "SWAP" as const,
  environment: "MAINNET" as const,
  chainId: 8453,
  tokenAddress: USDC,
  providerId: "0x",
  at: new Date("2026-11-14"),
};

describe("calculateFee", () => {
  it("applies a 30 bps rate in integer base units, rounding down", () => {
    const q = calculateFee(1_000_000n, base({}));
    expect(q.feeAmount).toBe(3_000n);
    expect(q.amountAfterFee).toBe(997_000n);
    expect(q.noFee).toBe(false);
  });

  it("rounds down rather than overcharging", () => {
    expect(calculateFee(333n, base({})).feeAmount).toBe(0n);
    expect(calculateFee(334n, base({})).feeAmount).toBe(1n);
  });

  it("supports fractional bps", () => {
    const q = calculateFee(10_000_000n, base({ rateCentiBps: bpsToCentiBps(10.25) }));
    expect(q.feeAmount).toBe(10_250n);
  });

  it("enforces min and max bounds and never exceeds the amount", () => {
    expect(calculateFee(1_000n, base({ minFee: 50n })).feeAmount).toBe(50n);
    expect(calculateFee(10n ** 12n, base({ maxFee: 1_000n })).feeAmount).toBe(1_000n);
    expect(calculateFee(20n, base({ minFee: 50n })).feeAmount).toBe(20n);
  });

  it("returns no fee when config is missing or zero", () => {
    expect(calculateFee(100n, null)).toMatchObject({ feeAmount: 0n, amountAfterFee: 100n, noFee: true });
    expect(calculateFee(100n, base({ rateCentiBps: 0 })).noFee).toBe(true);
  });

  it("rejects rates above the 5% safety ceiling and negative amounts", () => {
    expect(() => calculateFee(100n, base({ rateCentiBps: 50_001 }))).toThrow();
    expect(() => calculateFee(-1n, base({}))).toThrow();
  });
});

describe("resolveFeeConfiguration", () => {
  it("prefers the most specific matching configuration", () => {
    const configs = [
      base({ id: "global" }),
      base({ id: "chain", chainId: 8453, rateCentiBps: 2000 }),
      base({ id: "chain-token", chainId: 8453, tokenAddress: USDC, rateCentiBps: 1000 }),
      base({ id: "provider", providerId: "0x", rateCentiBps: 2500 }),
    ];
    expect(resolveFeeConfiguration(configs, ctx)?.id).toBe("chain-token");
  });

  it("never applies a testnet configuration to mainnet activity, or vice versa", () => {
    const configs = [base({ id: "testnet", environment: "TESTNET" })];
    expect(resolveFeeConfiguration(configs, ctx)).toBeNull();
    expect(resolveFeeConfiguration(configs, { ...ctx, environment: "TESTNET" })?.id).toBe("testnet");
  });

  it("ignores disabled, expired and future configurations", () => {
    const configs = [
      base({ id: "disabled", enabled: false }),
      base({ id: "expired", activeTo: new Date("2026-06-01") }),
      base({ id: "future", activeFrom: new Date("2027-01-01") }),
    ];
    expect(resolveFeeConfiguration(configs, ctx)).toBeNull();
  });

  it("picks the newest version at equal specificity", () => {
    const configs = [base({ id: "v1", version: 1 }), base({ id: "v2", version: 2, rateCentiBps: 2000 })];
    expect(quoteFee(configs, ctx, 1_000_000n)).toMatchObject({ configurationId: "v2", feeAmount: 2_000n });
  });

  it("matches token addresses case-insensitively", () => {
    const configs = [base({ id: "t", tokenAddress: USDC.toUpperCase().replace("0X", "0x") })];
    expect(resolveFeeConfiguration(configs, ctx)?.id).toBe("t");
  });
});

describe("formatRate", () => {
  it("formats centi-bps as a percentage", () => {
    expect(formatRate(3000)).toBe("0.30%");
    expect(formatRate(1025)).toBe("0.10%");
  });
});
