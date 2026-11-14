/**
 * User documentation (spec §20). Pages are plain data so they can move to MDX
 * or a CMS later without touching the layout.
 */
export interface DocPage {
  slug: string;
  title: string;
  summary: string;
  sections: { heading: string; body: string[] }[];
}

export const DOCS: DocPage[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    summary: "Connect a wallet, sign in and find your way around.",
    sections: [
      {
        heading: "Connect your wallet",
        body: [
          "Select Connect wallet in the top bar and choose your wallet. Browser wallets such as MetaMask or Rabby work directly. Mobile wallets connect through WalletConnect by scanning a QR code.",
          "Connecting only shares your public address. It does not move funds or give HENSENG any control of your wallet.",
        ],
      },
      {
        heading: "Sign in",
        body: [
          "After connecting, select Sign in. Your wallet asks you to sign a short message that starts with the HENSENG domain. Signing it proves you own the address. It is not a transaction and costs no gas.",
          "Before you sign, check that the domain in the message matches the address bar. Never sign a sign-in message for HENSENG on any other website.",
        ],
      },
      {
        heading: "Switch networks",
        body: [
          "Select the network name next to your address to switch. If your wallet is on a network HENSENG cannot connect to, you will see Switch network instead.",
          "Being able to connect on a network does not mean swaps or bridges work there. The Chains page shows which networks are live.",
        ],
      },
    ],
  },
  {
    slug: "fees",
    title: "Gas and protocol fees",
    summary: "What you pay, and when you see it.",
    sections: [
      {
        heading: "The fees you can be charged",
        body: [
          "Network gas is paid to the blockchain's validators, never to HENSENG. Provider fees are charged by the aggregator or bridge that executes your route. The HENSENG protocol fee is a percentage of your trade.",
          "All three are listed separately before you confirm, with the amount you are expected to receive. HENSENG never deducts a fee that was not shown.",
        ],
      },
      {
        heading: "Rates",
        body: [
          "The mainnet fee rates will be published here before mainnet launch. Testnet fees, where switched on, use test tokens only and are never counted as revenue.",
        ],
      },
    ],
  },
  {
    slug: "security",
    title: "Security precautions",
    summary: "How HENSENG protects you, and how to protect yourself.",
    sections: [
      {
        heading: "What HENSENG will never do",
        body: [
          "Ask for your seed phrase or private key, by any channel. Ask you to send funds to an address in a direct message. Hold your funds on your behalf.",
        ],
      },
      {
        heading: "Before you sign",
        body: [
          "Check the network, the tokens, the amounts and the spender address shown in your wallet. Prefer exact-amount approvals. Use a hardware wallet for larger balances.",
          "Claim links for airdrops are only shown when they match the project's official domain. Even so, check the URL yourself before connecting.",
        ],
      },
      {
        heading: "Audit status",
        body: [
          "HENSENG has not been independently audited. Swaps and bridges run through third-party providers, and each one is assessed before it is enabled and can be switched off at any time.",
        ],
      },
    ],
  },
  {
    slug: "hxp",
    title: "HXP points",
    summary: "What HXP is, and what it is not.",
    sections: [
      {
        heading: "What HXP is",
        body: [
          "HXP is a points balance recorded in HENSENG's own ledger. It recognises genuine activity such as eligible swaps and bridges, verified campaign tasks and qualified referrals.",
        ],
      },
      {
        heading: "What HXP is not",
        body: [
          "HXP is not a cryptocurrency or a token, and it has no monetary value. It cannot be transferred or redeemed, and there is no promise that it will ever convert into anything.",
          "Activity designed only to farm points, such as wash trading, self-referrals or duplicate accounts, earns no HXP and may be removed.",
        ],
      },
    ],
  },
  {
    slug: "testnet",
    title: "Testnet and mainnet",
    summary: "Two separate modes, never mixed.",
    sections: [
      {
        heading: "Testnet mode",
        body: [
          "Testnets such as Sepolia and Base Sepolia work like real networks, but their tokens have no value. Get test ETH from a faucet, then practise without risk.",
          "Many token pairs have little or no liquidity on testnets. When there is no route, HENSENG tells you rather than showing a quote.",
        ],
      },
      {
        heading: "Mainnet mode",
        body: [
          "Mainnet uses real assets. Transactions are final once confirmed. Your history, points and HENSENG's public figures keep testnet and mainnet separate.",
        ],
      },
    ],
  },
];

export const PLANNED_DOCS = [
  "Testnet swaps",
  "Mainnet swaps",
  "Bridging",
  "Slippage",
  "Transaction tracking",
  "Airdrop discovery",
  "Campaign participation",
  "Troubleshooting",
  "Partner and developer API",
  "Analytics methodology",
];

export function getDoc(slug: string) {
  return DOCS.find((d) => d.slug === slug);
}
