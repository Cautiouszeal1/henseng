/**
 * Curated tokens the wallet reads on each network.
 *
 * Every address here was checked against the issuer's documentation or the
 * network's canonical deployment (USDC: Circle's official address list).
 * Never add an address without checking it: a wrong token address means lost funds.
 */

export interface TokenInfo {
  chainId: number;
  /** null = the network's native asset (ETH, or SOL on Solana). EVM: 0x address; Solana: mint (base58, case-sensitive). */
  address: string | null;
  symbol: string;
  name: string;
  decimals: number;
  /** CoinGecko id used for USD prices; omitted for testnet assets, which have no value */
  priceId?: string;
}

export const CHAIN_IDS = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  sepolia: 11155111,
  baseSepolia: 84532,
  solana: 101,
  solanaDevnet: 103,
} as const;

const eth = (chainId: number, testnet = false): TokenInfo => ({
  chainId,
  address: null,
  symbol: "ETH",
  name: testnet ? "Test Ether" : "Ether",
  decimals: 18,
  priceId: testnet ? undefined : "ethereum",
});

export const TOKENS: TokenInfo[] = [
  // Ethereum
  eth(CHAIN_IDS.ethereum),
  { chainId: CHAIN_IDS.ethereum, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", name: "USD Coin", decimals: 6, priceId: "usd-coin" },
  { chainId: CHAIN_IDS.ethereum, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", name: "Tether USD", decimals: 6, priceId: "tether" },
  { chainId: CHAIN_IDS.ethereum, address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", name: "Dai", decimals: 18, priceId: "dai" },
  { chainId: CHAIN_IDS.ethereum, address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", name: "Wrapped Ether", decimals: 18, priceId: "weth" },
  // Base
  eth(CHAIN_IDS.base),
  { chainId: CHAIN_IDS.base, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", name: "USD Coin", decimals: 6, priceId: "usd-coin" },
  { chainId: CHAIN_IDS.base, address: "0x4200000000000000000000000000000000000006", symbol: "WETH", name: "Wrapped Ether", decimals: 18, priceId: "weth" },
  // Arbitrum One
  eth(CHAIN_IDS.arbitrum),
  { chainId: CHAIN_IDS.arbitrum, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", name: "USD Coin", decimals: 6, priceId: "usd-coin" },
  { chainId: CHAIN_IDS.arbitrum, address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", name: "Tether USD", decimals: 6, priceId: "tether" },
  { chainId: CHAIN_IDS.arbitrum, address: "0x912CE59144191C1204E64559FE8253a0e49E6548", symbol: "ARB", name: "Arbitrum", decimals: 18, priceId: "arbitrum" },
  { chainId: CHAIN_IDS.arbitrum, address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", name: "Wrapped Ether", decimals: 18, priceId: "weth" },
  // Testnets (no value)
  eth(CHAIN_IDS.sepolia, true),
  { chainId: CHAIN_IDS.sepolia, address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", symbol: "USDC", name: "Test USDC", decimals: 6 },
  eth(CHAIN_IDS.baseSepolia, true),
  { chainId: CHAIN_IDS.baseSepolia, address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", symbol: "USDC", name: "Test USDC", decimals: 6 },
  // Solana (USDC mints from Circle's official list)
  { chainId: CHAIN_IDS.solana, address: null, symbol: "SOL", name: "Solana", decimals: 9, priceId: "solana" },
  { chainId: CHAIN_IDS.solana, address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", name: "USD Coin", decimals: 6, priceId: "usd-coin" },
  { chainId: CHAIN_IDS.solanaDevnet, address: null, symbol: "SOL", name: "Devnet SOL", decimals: 9 },
  { chainId: CHAIN_IDS.solanaDevnet, address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", symbol: "USDC", name: "Test USDC", decimals: 6 },
];

const isSolanaId = (id: number) => id === CHAIN_IDS.solana || id === CHAIN_IDS.solanaDevnet;

/** Stable key; EVM addresses are case-insensitive, Solana mints are not. */
export const tokenKey = (t: Pick<TokenInfo, "chainId" | "address">) =>
  `${t.chainId}:${t.address ? (isSolanaId(t.chainId) ? t.address : t.address.toLowerCase()) : "native"}`;

export function tokensFor(chainId: number): TokenInfo[] {
  return TOKENS.filter((t) => t.chainId === chainId);
}

export function findToken(chainId: number, address: string | null): TokenInfo | undefined {
  return TOKENS.find((t) => t.chainId === chainId && tokenKey(t) === tokenKey({ chainId, address }));
}

/** Every CoinGecko id the app may ask prices for. The price API only accepts these. */
export const PRICE_IDS = [...new Set(TOKENS.map((t) => t.priceId).filter((x): x is string => !!x))];

export const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;
