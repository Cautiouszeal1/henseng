import { describe, expect, it } from "vitest";
import { chainInputSchema, detectSymbolImpersonation, explorerTxUrl, normalizeAddress, tokenInputSchema } from "./registry";
import { hasPermission, permissionsFor } from "./rbac";
import { formatMetric, UNAVAILABLE_LABEL } from "./metrics";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

describe("registry validation", () => {
  it("accepts a valid chain and rejects bad explorer URLs and chain ids", () => {
    const ok = chainInputSchema.safeParse({
      chainId: 8453, name: "Base", environment: "MAINNET", nativeSymbol: "ETH", explorerUrl: "https://basescan.org",
    });
    expect(ok.success).toBe(true);
    expect(chainInputSchema.safeParse({ chainId: -1, name: "x", environment: "MAINNET", nativeSymbol: "E", explorerUrl: "https://a.b" }).success).toBe(false);
    expect(chainInputSchema.safeParse({ chainId: 1, name: "Eth", environment: "MAINNET", nativeSymbol: "ETH", explorerUrl: "http://insecure.io" }).success).toBe(false);
  });

  it("validates and checksums token addresses", () => {
    expect(tokenInputSchema.safeParse({ chainId: 8453, address: "0x1234", symbol: "X", name: "X", decimals: 18 }).success).toBe(false);
    expect(normalizeAddress(BASE_USDC.toLowerCase())).toBe(BASE_USDC);
    expect(() => normalizeAddress("not-an-address")).toThrow();
  });

  it("flags tokens impersonating a verified symbol", () => {
    const verified = [{ chainId: 8453, address: BASE_USDC, symbol: "USDC" }];
    expect(detectSymbolImpersonation({ chainId: 8453, address: "0x000000000000000000000000000000000000dEaD", symbol: "usdc" }, verified)).toBe(true);
    expect(detectSymbolImpersonation({ chainId: 8453, address: BASE_USDC.toLowerCase(), symbol: "USDC" }, verified)).toBe(false);
    expect(detectSymbolImpersonation({ chainId: 8453, address: "0x000000000000000000000000000000000000dEaD", symbol: "PEPE" }, verified)).toBe(false);
  });

  it("builds explorer links", () => {
    expect(explorerTxUrl("https://basescan.org/", "0xabc")).toBe("https://basescan.org/tx/0xabc");
  });
});

describe("rbac", () => {
  it("grants super admin everything and read-only only view", () => {
    expect(hasPermission(["SUPER_ADMIN"], "roles.manage")).toBe(true);
    expect([...permissionsFor(["READ_ONLY_ADMIN"])]).toEqual(["admin.view"]);
    expect(hasPermission(["ANALYST"], "fees.write")).toBe(false);
    expect(hasPermission([], "admin.view")).toBe(false);
  });
});

describe("metrics", () => {
  it("shows the unavailable label rather than a number when no data exists", () => {
    expect(formatMetric({ status: "unavailable", reason: "indexer not running" })).toBe(UNAVAILABLE_LABEL);
    expect(formatMetric({ status: "available", value: 1200, asOf: new Date(), provenance: "db" })).toBe("1,200");
  });
});
