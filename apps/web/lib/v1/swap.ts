import "server-only";
import { checkQuote, findToken, NATIVE_TOKEN, SLIPPAGE_OPTIONS, SWAP_CHAIN_IDS, type SwapFee, type SwapQuote } from "@henseng/wallet";

/**
 * Swap and bridge quotes from LI.FI, proxied so the API key and integrator settings stay on
 * the server. Only HENSENG's verified tokens on Ethereum, Base and Arbitrum are accepted, the
 * sender is always the signed-in user, and every quote passes checkQuote() before it's returned.
 *
 * Env: LIFI_API_KEY (optional, higher rate limits), LIFI_INTEGRATOR + SWAP_FEE (optional
 * HENSENG fee, e.g. 0.0025 = 0.25%; shown to the user in the quote's fee list),
 * LIFI_API_BASE (tests point it at a local fake).
 */
export class SwapError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const base = () => process.env.LIFI_API_BASE || "https://li.quest/v1";
const headers = (): Record<string, string> => ({ accept: "application/json", ...(process.env.LIFI_API_KEY ? { "x-lifi-api-key": process.env.LIFI_API_KEY } : {}) });

export interface QuoteInput {
  fromChain: number;
  toChain: number;
  fromToken: string; // "native" or address
  toToken: string;
  fromAmount: string;
  slippage: number;
}

function resolveToken(chainId: number, t: string) {
  if (!SWAP_CHAIN_IDS.includes(chainId as never)) throw new SwapError(400, "BAD_REQUEST", "Swaps and bridging work on Ethereum, Base and Arbitrum.");
  const info = findToken(chainId, t === "native" ? null : t);
  if (!info) throw new SwapError(400, "BAD_REQUEST", "Only HENSENG's verified tokens can be swapped for now.");
  return { info, address: info.address ?? NATIVE_TOKEN };
}

type LifiCost = { name?: string; amountUSD?: string; included?: boolean };
type LifiQuote = {
  id: string;
  tool: string;
  toolDetails?: { name?: string };
  action: { fromChainId: number; toChainId: number; fromToken: { address: string }; toToken: { address: string }; fromAmount: string };
  estimate: { toAmount: string; toAmountMin: string; approvalAddress?: string; fromAmountUSD?: string; toAmountUSD?: string; executionDuration?: number; feeCosts?: LifiCost[]; gasCosts?: LifiCost[] };
  transactionRequest: { to: string; from: string; data: string; value: string; chainId: number; gasLimit?: string };
};

const usd = (s?: string) => (s && Number.isFinite(Number(s)) ? Number(s) : null);

export async function getQuote(address: string, input: QuoteInput): Promise<SwapQuote> {
  const from = resolveToken(input.fromChain, input.fromToken);
  const to = resolveToken(input.toChain, input.toToken);
  if (!/^\d{1,40}$/.test(input.fromAmount) || BigInt(input.fromAmount) === 0n) throw new SwapError(400, "BAD_REQUEST", "Enter an amount above zero.");
  if (!SLIPPAGE_OPTIONS.includes(input.slippage as never)) throw new SwapError(400, "BAD_REQUEST", "Unsupported slippage.");
  if (input.fromChain === input.toChain && from.address.toLowerCase() === to.address.toLowerCase()) throw new SwapError(400, "BAD_REQUEST", "Pick two different tokens.");

  const params = new URLSearchParams({
    fromChain: String(input.fromChain),
    toChain: String(input.toChain),
    fromToken: from.address,
    toToken: to.address,
    fromAmount: input.fromAmount,
    fromAddress: address,
    toAddress: address,
    slippage: String(input.slippage),
  });
  const fee = Number(process.env.SWAP_FEE);
  if (process.env.LIFI_INTEGRATOR) params.set("integrator", process.env.LIFI_INTEGRATOR);
  if (process.env.LIFI_INTEGRATOR && fee > 0 && fee <= 0.03) params.set("fee", String(fee));

  let res: Response;
  try {
    res = await fetch(`${base()}/quote?${params}`, { headers: headers(), signal: AbortSignal.timeout(20_000), cache: "no-store" });
  } catch {
    throw new SwapError(502, "UPSTREAM", "Couldn't reach the quote service. Try again.");
  }
  if (res.status === 404 || res.status === 422 || res.status === 400) {
    throw new SwapError(422, "NO_ROUTE", "No route for this swap right now. Try a different amount or token.");
  }
  if (res.status === 429) throw new SwapError(429, "RATE_LIMITED", "Too many quote requests. Wait a moment.");
  if (!res.ok) throw new SwapError(502, "UPSTREAM", "The quote service had a problem. Try again.");
  const q = (await res.json()) as LifiQuote;

  const fees: SwapFee[] = (q.estimate.feeCosts ?? []).map((f) => ({ name: (f.name ?? "Fee").slice(0, 60), amountUsd: usd(f.amountUSD), included: f.included !== false }));
  const gasUsd = (q.estimate.gasCosts ?? []).reduce<number | null>((sum, g) => (usd(g.amountUSD) === null ? sum : (sum ?? 0) + usd(g.amountUSD)!), null);
  const quote: SwapQuote = {
    id: String(q.id),
    tool: String(q.tool).slice(0, 40),
    toolName: (q.toolDetails?.name ?? q.tool).slice(0, 40),
    fromChain: q.action.fromChainId,
    toChain: q.action.toChainId,
    fromToken: q.action.fromToken.address,
    toToken: q.action.toToken.address,
    fromAmount: q.action.fromAmount,
    toAmount: q.estimate.toAmount,
    toAmountMin: q.estimate.toAmountMin,
    fromAmountUsd: usd(q.estimate.fromAmountUSD),
    toAmountUsd: usd(q.estimate.toAmountUSD),
    gasUsd,
    fees,
    approvalAddress: q.estimate.approvalAddress ?? null,
    durationSec: typeof q.estimate.executionDuration === "number" ? q.estimate.executionDuration : null,
    tx: {
      to: q.transactionRequest.to,
      from: q.transactionRequest.from,
      data: q.transactionRequest.data,
      value: q.transactionRequest.value,
      chainId: q.transactionRequest.chainId,
      gasLimit: q.transactionRequest.gasLimit ?? null,
    },
  };
  const problem = checkQuote(quote, { fromChain: input.fromChain, toChain: input.toChain, fromToken: from.address, toToken: to.address, fromAmount: input.fromAmount, fromAddress: address });
  if (problem) {
    console.warn(`[swap] refused quote ${quote.id}: ${problem}`);
    throw new SwapError(502, "UNSAFE_QUOTE", `This quote was refused for your safety: ${problem}`);
  }
  return quote;
}

export interface TransferStatus {
  status: "PENDING" | "DONE" | "FAILED" | "NOT_FOUND";
  substatus: string | null;
  receiving: { txHash: string | null; chainId: number | null; amount: string | null } | null;
}

export async function getStatus(txHash: string, fromChain: number, toChain: number, bridge: string): Promise<TransferStatus> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new SwapError(400, "BAD_REQUEST", "Invalid transaction hash.");
  if (!SWAP_CHAIN_IDS.includes(fromChain as never) || !SWAP_CHAIN_IDS.includes(toChain as never)) throw new SwapError(400, "BAD_REQUEST", "Unsupported network.");
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(bridge)) throw new SwapError(400, "BAD_REQUEST", "Invalid route.");
  const params = new URLSearchParams({ txHash, fromChain: String(fromChain), toChain: String(toChain), bridge });
  const res = await fetch(`${base()}/status?${params}`, { headers: headers(), signal: AbortSignal.timeout(15_000), cache: "no-store" }).catch(() => null);
  if (!res) throw new SwapError(502, "UPSTREAM", "Couldn't reach the status service.");
  if (res.status === 404) return { status: "NOT_FOUND", substatus: null, receiving: null };
  if (!res.ok) throw new SwapError(502, "UPSTREAM", "The status service had a problem.");
  const s = (await res.json()) as { status: string; substatus?: string; receiving?: { txHash?: string; chainId?: number; amount?: string } };
  const status = (["PENDING", "DONE", "FAILED", "NOT_FOUND"].includes(s.status) ? s.status : "PENDING") as TransferStatus["status"];
  return {
    status,
    substatus: s.substatus ? String(s.substatus).slice(0, 40) : null,
    receiving: s.receiving ? { txHash: s.receiving.txHash ?? null, chainId: s.receiving.chainId ?? null, amount: s.receiving.amount ?? null } : null,
  };
}
