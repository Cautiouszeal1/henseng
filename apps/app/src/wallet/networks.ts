import { createPublicClient, http, type PublicClient } from "viem";
import { arbitrum, base, baseSepolia, mainnet, sepolia, type Chain } from "viem/chains";

/** What every network has, EVM or Solana. */
export interface NetworkInfo {
  id: number;
  kind: "evm" | "solana";
  name: string;
  short: string;
  color: string;
  testnet: boolean;
  explorer: string;
}

export interface Network extends NetworkInfo {
  kind: "evm";
  chain: Chain;
  name: string;
  short: string;
  color: string;
  testnet: boolean;
  explorer: string;
}

const evm = (chain: Chain, rest: Omit<Network, "id" | "kind" | "chain">): Network => ({ id: chain.id, kind: "evm", chain, ...rest });

/** EVM networks the wallet supports. */
export const NETWORKS: Network[] = [
  evm(mainnet, { name: "Ethereum", short: "ETH", color: "#627EEA", testnet: false, explorer: "https://etherscan.io" }),
  evm(base, { name: "Base", short: "BASE", color: "#0052FF", testnet: false, explorer: "https://basescan.org" }),
  evm(arbitrum, { name: "Arbitrum", short: "ARB", color: "#28A0F0", testnet: false, explorer: "https://arbiscan.io" }),
  evm(sepolia, { name: "Sepolia", short: "SEP", color: "#8957FF", testnet: true, explorer: "https://sepolia.etherscan.io" }),
  evm(baseSepolia, { name: "Base Sepolia", short: "BSEP", color: "#397BFF", testnet: true, explorer: "https://sepolia.basescan.org" }),
];

/** Solana clusters, sharing the same recovery phrase (different address). */
export const SOLANA_NETWORKS: NetworkInfo[] = [
  { id: 101, kind: "solana", name: "Solana", short: "SOL", color: "#14F195", testnet: false, explorer: "https://explorer.solana.com" },
  { id: 103, kind: "solana", name: "Solana Devnet", short: "SOLD", color: "#9945FF", testnet: true, explorer: "https://explorer.solana.com" },
];

export const ALL_NETWORKS: NetworkInfo[] = [...NETWORKS, ...SOLANA_NETWORKS];
export const networkInfo = (id: number) => ALL_NETWORKS.find((n) => n.id === id);

export function networkFor(chainId: number): Network | undefined {
  return NETWORKS.find((n) => n.chain.id === chainId);
}

/**
 * Optional RPC endpoints per network (e.g. an Alchemy or QuickNode URL). Without them the
 * wallet uses each network's public RPC, which is rate-limited. Expo only inlines
 * EXPO_PUBLIC_* variables referenced by their full name, so each one is listed.
 */
const RPC_OVERRIDES: Record<number, string | undefined> = {
  1: process.env.EXPO_PUBLIC_RPC_URL_1,
  8453: process.env.EXPO_PUBLIC_RPC_URL_8453,
  42161: process.env.EXPO_PUBLIC_RPC_URL_42161,
  11155111: process.env.EXPO_PUBLIC_RPC_URL_11155111,
  84532: process.env.EXPO_PUBLIC_RPC_URL_84532,
  101: process.env.EXPO_PUBLIC_RPC_URL_101,
  103: process.env.EXPO_PUBLIC_RPC_URL_103,
};

export function rpcUrl(chainId: number): string | undefined {
  return RPC_OVERRIDES[chainId] || undefined;
}

const clients = new Map<number, PublicClient>();
export function publicClient(chainId: number): PublicClient {
  let c = clients.get(chainId);
  if (!c) {
    const network = networkFor(chainId);
    if (!network) throw new Error(`Unsupported network ${chainId}`);
    c = createPublicClient({ chain: network.chain, transport: http(rpcUrl(chainId), { timeout: 12_000, retryCount: 1 }) }) as PublicClient;
    clients.set(chainId, c);
  }
  return c;
}

const cluster = (chainId: number) => (chainId === 103 ? "?cluster=devnet" : "");
export const explorerTx = (chainId: number, hash: string) =>
  `${networkInfo(chainId)?.explorer ?? "https://etherscan.io"}/tx/${hash}${cluster(chainId)}`;
export const explorerAddress = (chainId: number, address: string) =>
  `${networkInfo(chainId)?.explorer ?? "https://etherscan.io"}/address/${address}${cluster(chainId)}`;
