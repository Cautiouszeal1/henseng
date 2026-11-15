import { ERC20_ABI, maxNetworkFee, type TokenInfo } from "@henseng/wallet";
import { encodeFunctionData } from "viem";
import { estimateL1Fee } from "viem/op-stack";
import { networkFor, publicClient } from "./networks";

export interface TxRequest {
  chainId: number;
  to: `0x${string}`;
  value: bigint;
  data?: `0x${string}`;
}

/** The on-chain transaction for sending `amount` of `token` to `recipient`. */
export function buildTransfer(token: TokenInfo, recipient: `0x${string}`, amount: bigint): TxRequest {
  if (!token.address) return { chainId: token.chainId, to: recipient, value: amount };
  return {
    chainId: token.chainId,
    to: token.address as `0x${string}`,
    value: 0n,
    data: encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [recipient, amount] }),
  };
}

export interface FeeEstimate {
  gas: bigint;
  /** Highest fee this transaction can cost, in wei of the network's ETH (includes padding and any L1 data fee). */
  maxFee: bigint;
}

/**
 * Estimates gas by simulating the transaction from the sender. A failed simulation
 * (e.g. not enough tokens) surfaces here, before the user signs anything.
 */
export async function estimateFee(from: `0x${string}`, tx: TxRequest): Promise<FeeEstimate> {
  const client = publicClient(tx.chainId);
  const [gasRaw, fees] = await Promise.all([
    client.estimateGas({ account: from, to: tx.to, value: tx.value, data: tx.data }),
    client.estimateFeesPerGas(),
  ]);
  const gas = (gasRaw * 120n) / 100n; // headroom; unused gas isn't charged
  let maxFee = maxNetworkFee(gas, fees.maxFeePerGas ?? fees.gasPrice ?? 0n, 0n);
  // OP-stack networks (Base) also charge for posting the transaction to Ethereum.
  const chain = networkFor(tx.chainId)?.chain;
  if (chain && "sourceId" in chain && chain.sourceId && chain.contracts && "gasPriceOracle" in chain.contracts) {
    const l1 = await estimateL1Fee(client, { account: from, chain, to: tx.to, value: tx.value, data: tx.data }).catch(() => 0n);
    maxFee += (l1 * 150n) / 100n;
  }
  return { gas, maxFee };
}

/** Turns RPC and viem errors into something a person can act on. */
export function sendErrorMessage(e: unknown): string {
  const m = e instanceof Error ? `${(e as { shortMessage?: string }).shortMessage ?? ""} ${e.message}` : String(e);
  if (/insufficient funds/i.test(m)) return "Not enough ETH to cover the amount and the network fee.";
  if (/transfer amount exceeds balance|exceeds balance/i.test(m)) return "You don't have enough of this token.";
  if (/nonce too low|already known/i.test(m)) return "A previous transaction is still being processed. Wait a moment and try again.";
  if (/user rejected|denied/i.test(m)) return "Cancelled.";
  if (/fetch|network|timeout|HTTP request failed|Failed to fetch/i.test(m)) return "Couldn't reach the network. Check your connection and try again.";
  if (/execution reverted/i.test(m)) return "The network would reject this transfer. The token may be paused or the recipient blocked.";
  return "The transaction couldn't be sent. Nothing left your wallet.";
}
