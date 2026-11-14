import { getAddress, isAddress, parseUnits } from "viem";

/**
 * What a scanned QR code or pasted text asks for.
 * Supports plain addresses and EIP-681 payment links:
 *   ethereum:0xabc…                         address
 *   ethereum:0xabc…@8453                    address on a chain
 *   ethereum:0xabc…?value=1e16              native amount in wei
 *   ethereum:0xTOKEN@8453/transfer?address=0xTO&uint256=1000000   token transfer
 * Amounts stay in base units; the caller formats them with the token's decimals.
 */
export type PaymentRequest =
  | { kind: "address"; to: `0x${string}`; chainId?: number; value?: bigint }
  | { kind: "token"; token: `0x${string}`; to: `0x${string}`; chainId?: number; amount?: bigint };

export type ParseResult = { ok: true; request: PaymentRequest } | { ok: false; reason: string };

/** "1e16", "10000000000000000", "2.5e18" → bigint (exact integers only). */
export function parseEipNumber(raw: string): bigint | null {
  const s = raw.trim();
  if (/^\d+$/.test(s)) return BigInt(s);
  const m = /^(\d+)(?:\.(\d+))?e(\d+)$/i.exec(s);
  if (!m) return null;
  const [, whole, frac = "", exp] = m;
  const e = Number(exp);
  if (frac.length > e) return null; // not an integer
  return BigInt(whole! + frac + "0".repeat(e - frac.length));
}

const addr = (s: string): `0x${string}` | null => (isAddress(s, { strict: false }) ? getAddress(s) : null);

export function parsePaymentText(input: string): ParseResult {
  const text = input.trim();
  if (!text) return { ok: false, reason: "Nothing to read." };
  const plain = addr(text);
  if (plain) return { ok: true, request: { kind: "address", to: plain } };

  const m = /^ethereum:(?:pay-)?([^@/?]+)(?:@(\d+))?(?:\/([A-Za-z]+))?(?:\?(.*))?$/i.exec(text);
  if (!m) {
    if (/^(bitcoin|solana|tron|litecoin):/i.test(text)) return { ok: false, reason: "That's not an Ethereum-network address. HENSENG can only send on Ethereum, Base and Arbitrum for now." };
    return { ok: false, reason: "That isn't a wallet address or payment link." };
  }
  const [, target, chain, fn, query = ""] = m;
  const targetAddr = addr(target!);
  if (!targetAddr) return { ok: false, reason: "The address in that link isn't valid." };
  const chainId = chain ? Number(chain) : undefined;
  const params = new URLSearchParams(query);

  if (!fn) {
    const v = params.get("value");
    const value = v != null ? parseEipNumber(v) : undefined;
    if (value === null) return { ok: false, reason: "The amount in that link isn't valid." };
    return { ok: true, request: { kind: "address", to: targetAddr, chainId, value } };
  }
  if (fn.toLowerCase() !== "transfer") return { ok: false, reason: "That link asks for a contract action HENSENG doesn't support. Only payments can be scanned." };
  const to = addr(params.get("address") ?? "");
  if (!to) return { ok: false, reason: "That payment link has no valid recipient." };
  const raw = params.get("uint256");
  const amount = raw != null ? parseEipNumber(raw) : undefined;
  if (amount === null) return { ok: false, reason: "The amount in that link isn't valid." };
  return { ok: true, request: { kind: "token", token: targetAddr, to, chainId, amount } };
}

/** Builds an EIP-681 link for a Receive QR code. */
export function paymentLink(to: string, chainId?: number): string {
  return `ethereum:${getAddress(to)}${chainId ? `@${chainId}` : ""}`;
}

export type AmountResult = { ok: true; value: bigint } | { ok: false; reason: string };

/**
 * Validates what a person typed in an amount field. Accepts "1", "0.5", ".5", "1,000.25"
 * (commas as thousands separators). Rejects more decimals than the token supports.
 */
export function parseAmountInput(input: string, decimals: number): AmountResult {
  const s = input.trim().replace(/,/g, "");
  if (!s) return { ok: false, reason: "Enter an amount." };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return { ok: false, reason: "Use numbers only, like 0.25." };
  const frac = s.split(".")[1] ?? "";
  if (frac.length > decimals) return { ok: false, reason: `This token allows up to ${decimals} decimal places.` };
  const value = parseUnits(s.startsWith(".") ? `0${s}` : s.endsWith(".") ? s.slice(0, -1) : s, decimals);
  if (value === 0n) return { ok: false, reason: "Enter an amount above zero." };
  return { ok: true, value };
}

/** Max fee for an EIP-1559 transaction, padded so the estimate still covers a small fee rise. */
export function maxNetworkFee(gas: bigint, maxFeePerGas: bigint, paddingPercent = 20n): bigint {
  return (gas * maxFeePerGas * (100n + paddingPercent)) / 100n;
}
