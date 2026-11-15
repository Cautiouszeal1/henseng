# HENSENG Super App — Phase 3b: Solana, your own tokens, NFTs, full history

## Status

| | Status |
|---|---|
| Solana address from the recovery phrase | Tested. It matches the address Phantom and Solflare give for the standard test phrase |
| Solana transactions (SOL, USDC, opening the recipient's USDC account) | Tested two ways. Every transaction decodes correctly with Solana's official library (`@solana/kit`). In the browser test, a fake Solana network checked each signature and applied each transfer: 5 USDC and 0.25 SOL arrived |
| Adding a token by contract address and sending it | Tested on a local chain. The token arrived on-chain |
| History (incoming and outgoing) and NFTs | Tested against a fake Alchemy server (API 58/58, browser 26/26) |
| **Real Solana devnet or mainnet** | **Not yet tested.** Public networks are blocked in the build sandbox. Try a small devnet send first |
| **Real Alchemy data** | **Not yet tested.** It needs `ALCHEMY_API_KEY` on the server |

## What's in it

**Solana**

- **Address:** the same recovery phrase now also gives a Solana address. It uses Phantom's path (m/44'/501'/0'/0'), so the account opens in Phantom, Solflare and Backpack too. It's shown on the wallet card and in Receive → Solana.
- **Balances:** SOL and USDC on Solana and on Solana Devnet. USDC uses Circle's official mint addresses.
- **Send:** works like the Ethereum flow (asset, recipient, amount, review, password). It refuses:
  - Ethereum-style addresses;
  - your own address;
  - token mint addresses;
  - SOL amounts below the minimum a new Solana account must hold.
- **Recipient's USDC account:** if the recipient doesn't have one yet, the send opens it for them. The one-time cost (about 0.002 SOL) is shown before you confirm.
- **Program addresses:** a warning appears if the recipient is a program address rather than a personal wallet.
- **How it's built:** transactions are built and signed on the device with audited crypto libraries. No Solana SDK ships in the app, which keeps it small and avoids polyfills on iOS and Android.

**Your own tokens**

- Wallet → Tokens → **Add a token**: choose the network and paste the contract address.
- The app checks a contract exists there and reads its name, symbol and decimals from the chain. Names are cleaned of hidden characters.
- Added tokens are labelled **Unverified**. They can be sent, and the review screen repeats the warning. They're never counted in the USD total, and they can be removed with the bin icon.

**NFTs**

- Wallet → **NFTs** shows what you hold on Ethereum, Base and Arbitrum, with a detail sheet (image, collection, contract, token ID, explorer link).
- Spam collections are hidden and counted, with a warning.
- Only `https` images load. `data:`, `javascript:` and similar links are dropped on the server.
- This is view only for now.

**Activity**

- Your sends (with live status) are merged with incoming and outgoing transfers from the server's indexer: ETH, tokens and NFTs.
- Incoming transfers of unverified tokens, a common airdrop scam, are hidden behind "Show hidden transfers", with a warning when shown.
- Solana activity lists sends made in HENSENG; Solana incoming history comes later.

**Server**

- `GET /api/v1/wallet/transfers?chainId=` and `GET /api/v1/wallet/nfts?chainId=` require sign-in, and only ever look up the signed-in user's own address, so HENSENG can't be used to snoop on other wallets.
- Results are cached for 30 seconds.
- Without `ALCHEMY_API_KEY` they return `NOT_CONFIGURED`, and the app says history isn't set up instead of showing nothing.
- `GET /api/v1/prices` now ignores price ids it doesn't know instead of failing, so older servers and newer apps work together.

## Configuration

| Where | Variable | Notes |
|---|---|---|
| API | `ALCHEMY_API_KEY` | History and NFTs. The free tier is enough to start |
| App | `EXPO_PUBLIC_RPC_URL_101`, `EXPO_PUBLIC_RPC_URL_103` | Solana mainnet and devnet RPC. Use a provider (Helius, QuickNode or Alchemy) for launch; the public endpoints are heavily rate-limited |

## Trying it safely

1. Turn on **Testnets**.
2. Copy your Solana address from Receive → Solana.
3. Get devnet SOL from faucet.solana.com and devnet USDC from Circle's faucet.
4. Send a small amount to a second wallet. Watching the same address in Phantom (devnet) is a good cross-check.

## Files

| Path | What it is |
|---|---|
| `packages/wallet/src/solana.ts` | Keys, addresses, token-account derivation, transaction building and signing (tests cross-check against `@solana/kit`) |
| `apps/app/src/wallet/solana-rpc.ts` | Minimal Solana RPC client |
| `apps/app/src/app/send-solana.tsx` | Solana send screen |
| `apps/app/src/wallet/use-portfolio.ts` | EVM and Solana balances, custom tokens, prices |
| `apps/app/src/wallet/use-indexer.ts` | History and NFT loading |
| `apps/app/src/features/wallet-activity.tsx`, `wallet-nfts.tsx` | Activity list and NFT gallery |
| `apps/web/lib/v1/indexer.ts` | Server-side Alchemy access, normalisation and spam filtering |

## Known limits

- **Sending NFTs** and **Solana NFTs** aren't supported yet.
- **Other Solana tokens** (beyond SOL and USDC) can't be added yet.
- **Solana incoming history** isn't indexed yet.
- **Swaps and bridging** are Phase 4.
