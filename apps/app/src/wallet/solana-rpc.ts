import { SOLANA_CLUSTERS, toBase64 } from "@henseng/wallet";
import { rpcUrl } from "./networks";

/**
 * Minimal Solana JSON-RPC client (fetch only). Endpoints default to Solana's public
 * RPC; set EXPO_PUBLIC_RPC_URL_101 / _103 to use your own (public ones are rate-limited).
 */
let id = 0;
export async function solanaRpc<T>(chainId: number, method: string, params: unknown[] = []): Promise<T> {
  const url = rpcUrl(chainId) ?? SOLANA_CLUSTERS.find((c) => c.id === chainId)?.rpc;
  if (!url) throw new Error("Unsupported Solana cluster");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }), signal: ctrl.signal });
    if (!res.ok) throw new Error(`Solana RPC returned ${res.status}`);
    const body = (await res.json()) as { result?: T; error?: { message: string; data?: { logs?: string[] } } };
    if (body.error) throw Object.assign(new Error(body.error.message), { logs: body.error.data?.logs });
    return body.result as T;
  } finally {
    clearTimeout(t);
  }
}

export const getSolBalance = async (chainId: number, address: string) =>
  BigInt((await solanaRpc<{ value: number }>(chainId, "getBalance", [address, { commitment: "confirmed" }])).value);

/** Total balance of `mint` across the owner's token accounts (base units). */
export async function getSplBalance(chainId: number, owner: string, mint: string): Promise<bigint> {
  const r = await solanaRpc<{ value: { account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } }[] }>(chainId, "getTokenAccountsByOwner", [
    owner,
    { mint },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  return r.value.reduce((sum, a) => sum + BigInt(a.account.data.parsed.info.tokenAmount.amount), 0n);
}

export const accountExists = async (chainId: number, address: string) =>
  (await solanaRpc<{ value: unknown | null }>(chainId, "getAccountInfo", [address, { encoding: "base64", commitment: "confirmed" }])).value !== null;

export const latestBlockhash = async (chainId: number) =>
  (await solanaRpc<{ value: { blockhash: string } }>(chainId, "getLatestBlockhash", [{ commitment: "confirmed" }])).value.blockhash;

export const rentExemptMinimum = async (chainId: number, bytes: number) =>
  BigInt(await solanaRpc<number>(chainId, "getMinimumBalanceForRentExemption", [bytes]));

export const sendRawSolana = (chainId: number, wire: Uint8Array) =>
  solanaRpc<string>(chainId, "sendTransaction", [toBase64(wire), { encoding: "base64", preflightCommitment: "confirmed" }]);

export async function signatureStatus(chainId: number, sig: string): Promise<"pending" | "confirmed" | "failed"> {
  const r = await solanaRpc<{ value: ({ err: unknown; confirmationStatus?: string } | null)[] }>(chainId, "getSignatureStatuses", [[sig], { searchTransactionHistory: true }]);
  const s = r.value[0];
  if (!s) return "pending";
  if (s.err) return "failed";
  return s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized" ? "confirmed" : "pending";
}
