import { arbitrum, base, baseSepolia, mainnet, sepolia } from "viem/chains";

/**
 * Chains the wallet layer can connect to. This list only controls wallet
 * connectivity; whether HENSENG *supports* swaps or bridges on a chain comes
 * from the registry in the database (enabled chain + verified provider).
 */
export const WALLET_CHAINS = [mainnet, base, arbitrum, sepolia, baseSepolia] as const;

export const WALLET_CHAIN_IDS = new Set<number>(WALLET_CHAINS.map((c) => c.id));

export function walletChain(chainId: number) {
  return WALLET_CHAINS.find((c) => c.id === chainId);
}
