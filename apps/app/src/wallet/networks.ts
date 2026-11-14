import { arbitrum, base, baseSepolia, mainnet, sepolia, type Chain } from "viem/chains";

export interface Network {
  chain: Chain;
  name: string;
  short: string;
  color: string;
  testnet: boolean;
  explorer: string;
}

/** Networks the wallet reads in Phase 1. Solana arrives in a later phase. */
export const NETWORKS: Network[] = [
  { chain: mainnet, name: "Ethereum", short: "ETH", color: "#627EEA", testnet: false, explorer: "https://etherscan.io" },
  { chain: base, name: "Base", short: "BASE", color: "#0052FF", testnet: false, explorer: "https://basescan.org" },
  { chain: arbitrum, name: "Arbitrum", short: "ARB", color: "#28A0F0", testnet: false, explorer: "https://arbiscan.io" },
  { chain: sepolia, name: "Sepolia", short: "SEP", color: "#8957FF", testnet: true, explorer: "https://sepolia.etherscan.io" },
  { chain: baseSepolia, name: "Base Sepolia", short: "BSEP", color: "#397BFF", testnet: true, explorer: "https://sepolia.basescan.org" },
];
