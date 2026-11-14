import { getAddress, isAddress } from "viem";
import { z } from "zod";

/**
 * Chain and token registry validation (spec §9).
 * The registry stores *metadata*; a chain only counts as supported once at least
 * one provider integration for it is enabled and health-checked.
 */

export const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

export const chainInputSchema = z.object({
  chainId: z.number().int().positive().max(2 ** 53 - 1),
  name: z.string().trim().min(2).max(64),
  environment: z.enum(["TESTNET", "MAINNET"]),
  nativeSymbol: z.string().trim().min(1).max(12),
  nativeDecimals: z.number().int().min(0).max(36).default(18),
  explorerUrl: z.url().refine((u) => u.startsWith("https://"), "Explorer URL must use https"),
  logoUrl: z.url().optional().nullable(),
});
export type ChainInput = z.infer<typeof chainInputSchema>;

export const tokenInputSchema = z.object({
  chainId: z.number().int().positive(),
  address: z.string().refine((a) => isAddress(a, { strict: false }), "Invalid EVM address"),
  symbol: z.string().trim().min(1).max(16),
  name: z.string().trim().min(1).max(64),
  decimals: z.number().int().min(0).max(36),
  logoUrl: z.url().optional().nullable(),
});
export type TokenInput = z.infer<typeof tokenInputSchema>;

/** Returns the checksummed address, or throws. */
export function normalizeAddress(address: string): `0x${string}` {
  if (!isAddress(address, { strict: false })) throw new Error(`Invalid address: ${address}`);
  return getAddress(address);
}

export type TokenRiskFlag =
  | "UNVERIFIED"
  | "SYMBOL_IMPERSONATION"
  | "LOW_LIQUIDITY"
  | "NO_ROUTE"
  | "HONEYPOT_SUSPECTED";

/** Well-known symbols that scam tokens commonly impersonate. */
const PROTECTED_SYMBOLS = new Set(["USDC", "USDT", "DAI", "WETH", "ETH", "WBTC", "ARB", "OP"]);

/**
 * Flags a token that uses a protected symbol but is not the verified token
 * registered for that symbol on that chain.
 */
export function detectSymbolImpersonation(
  token: { chainId: number; address: string; symbol: string },
  verified: readonly { chainId: number; address: string; symbol: string }[],
): boolean {
  const sym = token.symbol.trim().toUpperCase();
  if (!PROTECTED_SYMBOLS.has(sym)) return false;
  const addr = token.address.toLowerCase();
  const official = verified.filter((v) => v.chainId === token.chainId && v.symbol.toUpperCase() === sym);
  if (official.length === 0) return false;
  return !official.some((v) => v.address.toLowerCase() === addr);
}

export function explorerTxUrl(explorerUrl: string, txHash: string): string {
  return `${explorerUrl.replace(/\/$/, "")}/tx/${txHash}`;
}

export function explorerAddressUrl(explorerUrl: string, address: string): string {
  return `${explorerUrl.replace(/\/$/, "")}/address/${address}`;
}
