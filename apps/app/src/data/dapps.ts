/**
 * Curated dApp directory. These are real, live applications; each opens in the
 * HENSENG in-app browser. Inclusion is not an endorsement, and sponsored
 * listings (none yet) will always be labelled.
 */
export type DappCategory = "DeFi" | "NFTs" | "Bridges" | "Tools" | "Games" | "Social";

export interface Dapp {
  id: string;
  name: string;
  url: string;
  category: DappCategory;
  description: string;
  networks: string[];
  color: string;
  featured?: boolean;
}

export const DAPPS: Dapp[] = [
  { id: "uniswap", name: "Uniswap", url: "https://app.uniswap.org", category: "DeFi", description: "Swap tokens and provide liquidity.", networks: ["Ethereum", "Base", "Arbitrum"], color: "#FF007A", featured: true },
  { id: "aave", name: "Aave", url: "https://app.aave.com", category: "DeFi", description: "Lend and borrow crypto assets.", networks: ["Ethereum", "Base", "Arbitrum"], color: "#B6509E", featured: true },
  { id: "opensea", name: "OpenSea", url: "https://opensea.io", category: "NFTs", description: "Discover, collect and sell NFTs.", networks: ["Ethereum", "Base", "Arbitrum"], color: "#2081E2", featured: true },
  { id: "jumper", name: "Jumper", url: "https://jumper.exchange", category: "Bridges", description: "Bridge and swap across chains.", networks: ["Ethereum", "Base", "Arbitrum"], color: "#8957FF" },
  { id: "across", name: "Across", url: "https://app.across.to", category: "Bridges", description: "Fast transfers between L2s.", networks: ["Ethereum", "Base", "Arbitrum"], color: "#6CF9D8" },
  { id: "curve", name: "Curve", url: "https://curve.fi", category: "DeFi", description: "Stablecoin swaps with low slippage.", networks: ["Ethereum", "Base", "Arbitrum"], color: "#E4E4E4" },
  { id: "zora", name: "Zora", url: "https://zora.co", category: "NFTs", description: "Create and collect onchain media.", networks: ["Base"], color: "#5B5BD6" },
  { id: "etherscan", name: "Etherscan", url: "https://etherscan.io", category: "Tools", description: "Explore Ethereum transactions.", networks: ["Ethereum"], color: "#21325B" },
  { id: "revoke", name: "Revoke.cash", url: "https://revoke.cash", category: "Tools", description: "Review and revoke token approvals.", networks: ["Ethereum", "Base", "Arbitrum"], color: "#F5A524" },
  { id: "snapshot", name: "Snapshot", url: "https://snapshot.box", category: "Social", description: "Vote on DAO proposals.", networks: ["Ethereum"], color: "#FFAC33" },
  { id: "pancake", name: "PancakeSwap", url: "https://pancakeswap.finance", category: "DeFi", description: "Trade on multiple chains.", networks: ["Ethereum", "Base", "Arbitrum"], color: "#1FC7D4" },
];
