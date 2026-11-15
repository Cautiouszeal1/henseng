/**
 * Swap and bridge quotes come from LI.FI (an aggregator of DEXs and bridges).
 * HENSENG never signs a quote blindly: both the server and the app run checkQuote()
 * before anything is shown or signed. A quote must:
 *   - send the transaction to the LI.FI Diamond (the only contract we trust here),
 *   - ask for token approval only to that same contract, and only for the amount being swapped,
 *   - be on the chain the user picked, from the user's own address,
 *   - carry exactly the swapped amount as value for ETH, and no value for tokens,
 *   - promise a minimum output above zero.
 * Address source: LI.FI docs (Diamond 0x1231…4EaE on Ethereum, Base and Arbitrum).
 */
import { getAddress, isAddress } from "viem";

export const LIFI_DIAMOND = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
/** LI.FI uses the zero address for a network's native asset. */
export const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";
/** Networks where swaps and bridging are offered (LI.FI doesn't route testnets). */
export const SWAP_CHAIN_IDS = [1, 8453, 42161] as const;
export const SLIPPAGE_OPTIONS = [0.005, 0.01, 0.03] as const;
/** Value lost to fees and price impact above which the app warns, and above which it asks for explicit confirmation. */
export const VALUE_LOSS_WARN = 3;
export const VALUE_LOSS_CONFIRM = 10;

export interface SwapFee {
  name: string;
  amountUsd: number | null;
  /** true = taken from the amount you swap; false = paid on top */
  included: boolean;
}

/** Normalised quote, as the HENSENG API returns it. */
export interface SwapQuote {
  id: string;
  tool: string;
  toolName: string;
  fromChain: number;
  toChain: number;
  fromToken: string; // address, NATIVE_TOKEN for ETH
  toToken: string;
  fromAmount: string; // base units
  toAmount: string;
  toAmountMin: string;
  fromAmountUsd: number | null;
  toAmountUsd: number | null;
  gasUsd: number | null;
  fees: SwapFee[];
  approvalAddress: string | null;
  durationSec: number | null;
  tx: { to: string; from: string; data: string; value: string; chainId: number; gasLimit: string | null };
}

export interface QuoteExpectation {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
}

const same = (a: string | null | undefined, b: string) => !!a && isAddress(a, { strict: false }) && getAddress(a) === getAddress(b);

/** Returns a reason if the quote must not be signed, or null if it passes every check. */
export function checkQuote(q: SwapQuote, e: QuoteExpectation): string | null {
  if (!SWAP_CHAIN_IDS.includes(q.fromChain as never) || !SWAP_CHAIN_IDS.includes(q.toChain as never)) return "Unsupported network in quote.";
  if (q.fromChain !== e.fromChain || q.toChain !== e.toChain || q.tx.chainId !== e.fromChain) return "Quote is for a different network than you chose.";
  if (!same(q.fromToken, e.fromToken) || !same(q.toToken, e.toToken)) return "Quote is for different tokens than you chose.";
  if (q.fromAmount !== e.fromAmount) return "Quote is for a different amount than you entered.";
  if (!same(q.tx.from, e.fromAddress)) return "Quote isn't for your address.";
  if (!same(q.tx.to, LIFI_DIAMOND)) return "Quote sends your transaction to an unknown contract.";
  const native = same(e.fromToken, NATIVE_TOKEN);
  if (!native && !same(q.approvalAddress, LIFI_DIAMOND)) return "Quote asks you to approve an unknown contract.";
  let value: bigint;
  try {
    value = BigInt(q.tx.value);
  } catch {
    return "Quote has an invalid amount.";
  }
  if (native ? value !== BigInt(e.fromAmount) : value !== 0n) return "Quote would send a different amount of ETH than you entered.";
  if (!/^0x[0-9a-fA-F]*$/.test(q.tx.data) || q.tx.data.length < 10) return "Quote has no valid transaction data.";
  try {
    if (BigInt(q.toAmountMin) <= 0n || BigInt(q.toAmountMin) > BigInt(q.toAmount)) return "Quote's minimum output doesn't make sense.";
  } catch {
    return "Quote has an invalid output amount.";
  }
  return null;
}

/** % of USD value lost between what you send and what you get (fees + price impact). Null if unpriced. */
export function valueLossPercent(q: Pick<SwapQuote, "fromAmountUsd" | "toAmountUsd">): number | null {
  if (!q.fromAmountUsd || q.toAmountUsd === null || q.fromAmountUsd <= 0) return null;
  return Math.max(0, (1 - q.toAmountUsd / q.fromAmountUsd) * 100);
}

/** ERC-20 approve(spender, amount) calldata; we always approve the exact amount, never unlimited. */
export const ERC20_APPROVE_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
