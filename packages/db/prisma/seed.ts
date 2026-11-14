/**
 * Safe development seed (spec §23).
 *
 * Seeds registry METADATA only. Every chain, provider and chain↔provider row is
 * created DISABLED: nothing appears as "supported" until an admin enables it
 * after the integration has been built and tested. No users, transactions,
 * volume or analytics are seeded — HENSENG never fabricates activity.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const chains = [
  { id: 1, name: "Ethereum", environment: "MAINNET", nativeSymbol: "ETH", explorerUrl: "https://etherscan.io" },
  { id: 8453, name: "Base", environment: "MAINNET", nativeSymbol: "ETH", explorerUrl: "https://basescan.org" },
  { id: 42161, name: "Arbitrum One", environment: "MAINNET", nativeSymbol: "ETH", explorerUrl: "https://arbiscan.io" },
  { id: 11155111, name: "Sepolia", environment: "TESTNET", nativeSymbol: "ETH", explorerUrl: "https://sepolia.etherscan.io" },
  { id: 84532, name: "Base Sepolia", environment: "TESTNET", nativeSymbol: "ETH", explorerUrl: "https://sepolia.basescan.org" },
] as const;

const providers = [
  { id: "0x", name: "0x Swap API", kind: "SWAP", website: "https://0x.org", docsUrl: "https://docs.0x.org" },
  { id: "uniswap", name: "Uniswap API", kind: "SWAP", website: "https://developers.uniswap.org", docsUrl: "https://developers.uniswap.org/docs" },
  { id: "lifi", name: "LI.FI", kind: "BRIDGE", website: "https://li.fi", docsUrl: "https://docs.li.fi" },
] as const;

// Candidate chain coverage to investigate (from provider docs, Nov 2026). Rows
// stay disabled with verifiedAt = null until integration tests pass.
const candidateSupport: Array<[number, string]> = [
  [1, "0x"], [8453, "0x"], [42161, "0x"], [11155111, "0x"],
  [1, "uniswap"], [8453, "uniswap"], [42161, "uniswap"], [11155111, "uniswap"], [84532, "uniswap"],
  [1, "lifi"], [8453, "lifi"], [42161, "lifi"],
];

// Well-known canonical tokens (addresses from issuer documentation). Seeded
// disabled and PENDING_REVIEW so an admin must confirm them before use.
const tokens = [
  { chainId: 1, address: "0x0000000000000000000000000000000000000000", symbol: "ETH", name: "Ether", decimals: 18 },
  { chainId: 1, address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", symbol: "USDC", name: "USD Coin", decimals: 6 },
  { chainId: 8453, address: "0x0000000000000000000000000000000000000000", symbol: "ETH", name: "Ether", decimals: 18 },
  { chainId: 8453, address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC", name: "USD Coin", decimals: 6 },
  { chainId: 42161, address: "0x0000000000000000000000000000000000000000", symbol: "ETH", name: "Ether", decimals: 18 },
  { chainId: 42161, address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", symbol: "USDC", name: "USD Coin", decimals: 6 },
  { chainId: 11155111, address: "0x0000000000000000000000000000000000000000", symbol: "ETH", name: "Sepolia Ether", decimals: 18 },
  { chainId: 84532, address: "0x0000000000000000000000000000000000000000", symbol: "ETH", name: "Base Sepolia Ether", decimals: 18 },
];

async function main() {
  for (const c of chains) {
    await db.chain.upsert({ where: { id: c.id }, update: {}, create: { ...c, enabled: false } });
  }
  for (const p of providers) {
    await db.provider.upsert({ where: { id: p.id }, update: {}, create: { ...p, enabled: false } });
  }
  for (const [chainId, providerId] of candidateSupport) {
    await db.chainProviderSupport.upsert({
      where: { chainId_providerId: { chainId, providerId } },
      update: {},
      create: { chainId, providerId, enabled: false },
    });
  }
  for (const t of tokens) {
    await db.token.upsert({
      where: { chainId_address: { chainId: t.chainId, address: t.address } },
      update: {},
      create: { ...t, verificationStatus: "PENDING_REVIEW", enabled: false, source: "seed" },
    });
  }
  console.log(`Seeded ${chains.length} chains, ${providers.length} providers, ${tokens.length} tokens (all disabled).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
