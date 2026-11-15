import "server-only";
import { findToken } from "@henseng/wallet";

/**
 * Transfer history and NFTs for the signed-in user's own address, via Alchemy.
 *
 * - The Alchemy key stays on the server (ALCHEMY_API_KEY). Without it these
 *   endpoints answer 503 NOT_CONFIGURED and the app says so; nothing is faked.
 * - Only the caller's own verified address is ever looked up, so this can't be
 *   used to snoop on other wallets through HENSENG.
 * - Results are cached for 30 s per address/network.
 * - ALCHEMY_URL_TEMPLATE overrides the endpoint (tests use a local fake).
 */

export const INDEXED_NETWORKS: Record<number, string> = {
  1: "eth-mainnet",
  8453: "base-mainnet",
  42161: "arb-mainnet",
  11155111: "eth-sepolia",
  84532: "base-sepolia",
};

export class IndexerNotConfigured extends Error {}

export interface TransferView {
  id: string;
  hash: string;
  chainId: number;
  direction: "in" | "out";
  kind: "native" | "token" | "nft";
  symbol: string | null;
  /** Base units as a decimal string (exact), when known */
  amount: string | null;
  decimals: number | null;
  tokenAddress: string | null;
  tokenId: string | null;
  /** True for ETH and tokens on HENSENG's verified list; unknown tokens are often airdrop spam */
  verified: boolean;
  counterparty: string;
  timestamp: string | null;
}

export interface NftView {
  id: string;
  chainId: number;
  contract: string;
  tokenId: string;
  standard: "ERC721" | "ERC1155" | "UNKNOWN";
  balance: string;
  name: string;
  collection: string | null;
  description: string | null;
  image: string | null;
  thumbnail: string | null;
}

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  return value;
}

function base(chainId: number) {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) throw new IndexerNotConfigured("History and NFTs aren't set up on this server yet.");
  const network = INDEXED_NETWORKS[chainId];
  if (!network) throw new Error("Unsupported network");
  const template = process.env.ALCHEMY_URL_TEMPLATE || "https://{network}.g.alchemy.com";
  return { origin: template.replace("{network}", network), key };
}

async function rpc<T>(chainId: number, method: string, params: unknown[]): Promise<T> {
  const { origin, key } = base(chainId);
  const res = await fetch(`${origin}/v2/${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Indexer returned ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
  return body.result as T;
}

type RawTransfer = {
  uniqueId: string;
  hash: string;
  from: string;
  to: string | null;
  category: "external" | "internal" | "erc20" | "erc721" | "erc1155" | "specialnft";
  asset: string | null;
  tokenId?: string | null;
  erc1155Metadata?: { tokenId: string; value: string }[] | null;
  rawContract: { value: string | null; address: string | null; decimal: string | null };
  metadata?: { blockTimestamp?: string };
};

function normalizeTransfer(chainId: number, me: string, t: RawTransfer): TransferView {
  const direction = t.from.toLowerCase() === me ? "out" : "in";
  const nft = t.category === "erc721" || t.category === "erc1155" || t.category === "specialnft";
  const native = t.category === "external" || t.category === "internal";
  const tokenAddress = t.rawContract.address?.toLowerCase() ?? null;
  const decimals = t.rawContract.decimal ? Number(BigInt(t.rawContract.decimal)) : native ? 18 : null;
  const known = native ? findToken(chainId, null) : tokenAddress ? findToken(chainId, tokenAddress) : undefined;
  return {
    id: `${chainId}:${t.uniqueId}`,
    hash: t.hash,
    chainId,
    direction,
    kind: nft ? "nft" : native ? "native" : "token",
    symbol: known?.symbol ?? t.asset ?? null,
    amount: !nft && t.rawContract.value ? BigInt(t.rawContract.value).toString() : t.category === "erc1155" ? (t.erc1155Metadata?.[0]?.value ? BigInt(t.erc1155Metadata[0].value).toString() : null) : null,
    decimals: known?.decimals ?? decimals,
    tokenAddress,
    tokenId: t.tokenId ? BigInt(t.tokenId).toString() : t.erc1155Metadata?.[0]?.tokenId ? BigInt(t.erc1155Metadata[0].tokenId).toString() : null,
    verified: !!known,
    counterparty: (direction === "out" ? t.to : t.from) ?? "",
    timestamp: t.metadata?.blockTimestamp ?? null,
  };
}

export async function getTransfers(address: string, chainId: number): Promise<TransferView[]> {
  const me = address.toLowerCase();
  return cached(`tx:${chainId}:${me}`, async () => {
    // "internal" transfers are only indexed on Ethereum mainnet.
    const category = ["external", "erc20", "erc721", "erc1155", ...(chainId === 1 ? ["internal"] : [])];
    const q = { fromBlock: "0x0", toBlock: "latest", category, withMetadata: true, excludeZeroValue: true, maxCount: "0x32", order: "desc" };
    const [outgoing, incoming] = await Promise.all([
      rpc<{ transfers: RawTransfer[] }>(chainId, "alchemy_getAssetTransfers", [{ ...q, fromAddress: me }]),
      rpc<{ transfers: RawTransfer[] }>(chainId, "alchemy_getAssetTransfers", [{ ...q, toAddress: me }]),
    ]);
    const seen = new Set<string>();
    return [...outgoing.transfers, ...incoming.transfers]
      .filter((t) => (seen.has(t.uniqueId) ? false : (seen.add(t.uniqueId), true)))
      .map((t) => normalizeTransfer(chainId, me, t))
      .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""))
      .slice(0, 50);
  });
}

type RawNft = {
  contract: { address: string; name?: string | null; tokenType?: string; isSpam?: boolean | null; openSeaMetadata?: { collectionName?: string | null } | null };
  tokenId: string;
  tokenType?: string;
  name?: string | null;
  description?: string | null;
  balance?: string;
  image?: { cachedUrl?: string | null; thumbnailUrl?: string | null; originalUrl?: string | null } | null;
};

/** Only http(s) image URLs reach the app; data:, javascript: and ipfs:// without a gateway are dropped. */
const safeUrl = (u?: string | null) => (u && /^https:\/\//i.test(u) ? u : null);

export async function getNfts(address: string, chainId: number): Promise<{ nfts: NftView[]; hiddenSpam: number }> {
  const me = address.toLowerCase();
  return cached(`nft:${chainId}:${me}`, async () => {
    const { origin, key } = base(chainId);
    const url = `${origin}/nft/v3/${key}/getNFTsForOwner?owner=${me}&withMetadata=true&pageSize=100`;
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!res.ok) throw new Error(`Indexer returned ${res.status}`);
    const body = (await res.json()) as { ownedNfts: RawNft[] };
    const spam = body.ownedNfts.filter((n) => n.contract.isSpam === true);
    const nfts = body.ownedNfts
      .filter((n) => n.contract.isSpam !== true)
      .map((n): NftView => {
        const standard = (n.tokenType ?? n.contract.tokenType ?? "").toUpperCase();
        return {
          id: `${chainId}:${n.contract.address.toLowerCase()}:${n.tokenId}`,
          chainId,
          contract: n.contract.address.toLowerCase(),
          tokenId: n.tokenId,
          standard: standard === "ERC721" || standard === "ERC1155" ? standard : "UNKNOWN",
          balance: n.balance ?? "1",
          name: n.name?.trim() || `${n.contract.name ?? "Token"} #${n.tokenId.length > 12 ? `${n.tokenId.slice(0, 10)}…` : n.tokenId}`,
          collection: n.contract.openSeaMetadata?.collectionName ?? n.contract.name ?? null,
          description: n.description?.slice(0, 2000) ?? null,
          image: safeUrl(n.image?.cachedUrl) ?? safeUrl(n.image?.originalUrl),
          thumbnail: safeUrl(n.image?.thumbnailUrl) ?? safeUrl(n.image?.cachedUrl),
        };
      });
    return { nfts, hiddenSpam: spam.length };
  });
}
