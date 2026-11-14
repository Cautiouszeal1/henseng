import { createPublicClient, http, type PublicClient } from "viem";
import { arbitrum, base, baseSepolia, mainnet, sepolia, type Chain } from "viem/chains";

export interface Network {
  chain: Chain;
  name: string;
  short: string;
  color: string;
  testnet: boolean;
  explorer: string;
}

/** EVM networks the wallet supports. Solana arrives in Phase 3b. */
export const NETWORKS: Network[] = [
  { chain: mainnet, name: "Ethereum", short: "ETH", color: "#627EEA", testnet: false, explorer: "https://etherscan.io" },
  { chain: base, name: "Base", short: "BASE", color: "#0052FF", testnet: false, explorer: "https://basescan.org" },
  { chain: arbitrum, name: "Arbitrum", short: "ARB", color: "#28A0F0", testnet: false, explorer: "https://arbiscan.io" },
  { chain: sepolia, name: "Sepolia", short: "SEP", color: "#8957FF", testnet: true, explorer: "https://sepolia.etherscan.io" },
  { chain: baseSepolia, name: "Base Sepolia", short: "BSEP", color: "#397BFF", testnet: true, explorer: "https://sepolia.basescan.org" },
];

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

export const explorerTx = (chainId: number, hash: string) => `${networkFor(chainId)?.explorer ?? "https://etherscan.io"}/tx/${hash}`;
export const explorerAddress = (chainId: number, address: string) => `${networkFor(chainId)?.explorer ?? "https://etherscan.io"}/address/${address}`;
