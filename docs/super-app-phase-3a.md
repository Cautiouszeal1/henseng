# HENSENG Super App — Phase 3a: send, tokens, prices, QR

Phase 3a turns the wallet from read-only into one that sends. Transactions are signed on the device with the user's own key; HENSENG's server never sees the key and never handles funds.

Phase 3b will add NFTs, Solana, custom tokens and incoming-transfer history.

## Status

| | Status |
|---|---|
| Sending a token (USDC) and ETH, end to end | Tested on local blockchains that answer as Sepolia and as Base. Balances were checked on-chain after each send (26/26 browser checks) |
| Recipient checks, amount validation, fee preview, wrong password, pending → confirmed, activity list | Tested (same run) |
| QR payment links (EIP-681), pasting addresses and links | Tested via the paste path; the parser has unit tests |
| USD prices and total | Tested against a fake price source. The real source is CoinGecko |
| Camera scanning on a real phone | **Not yet tested.** It needs a device; the code uses `expo-camera`'s built-in QR scanner |
| Sends on real mainnet or testnet | **Not yet tested.** Public networks are blocked in the build sandbox. Try a small Sepolia send first (see below) |

## What's in it

**Balances**

- ETH plus a curated token list on each network:
  - **Ethereum:** USDC, USDT, DAI, WETH.
  - **Base:** USDC, WETH.
  - **Arbitrum:** USDC, USDT, ARB, WETH.
  - **Sepolia and Base Sepolia:** test USDC.
- Every token address is checked against the issuer or the network's canonical deployment (USDC: Circle's official list), and a unit test confirms each address checksum.
- Balances are read straight from each network, so HENSENG's server doesn't learn which addresses a user holds.
- Tokens appear once they have a balance; ETH is always listed.

**Prices**

- USD prices come from `GET /api/v1/prices` on the HENSENG API, which fetches them from CoinGecko and caches them for 60 seconds.
- If CoinGecko is down, the last price is used for up to 15 minutes and marked as possibly out of date. After that, no price is shown; one is never guessed.
- The total and the 24-hour change appear only when every mainnet balance has a price. If a network can't be reached, the total is labelled partial. Testnet tokens are never counted.

**Send**

The flow is: choose the asset, then the recipient, then the amount, then review, then confirm with the password. It starts from Wallet → Send, from tapping an asset, or from a scanned QR code.

The recipient can be:
- a `0x` address;
- an ENS name, looked up on Ethereum;
- a HENSENG `@username`;
- a pasted or scanned payment link.

Before the review screen, the app:
- refuses your own address, token contract addresses, amounts above your balance, and more decimals than the token allows;
- simulates the transaction, so a transfer that would fail is caught before you sign;
- checks there's enough ETH for the network fee, and says how much is needed if not.

The review screen shows:
- the full recipient address in groups, with the first and last characters highlighted;
- the network;
- the maximum network fee in ETH and USD, including the Ethereum data fee that Base charges;
- the total, when sending ETH;
- a warning if the recipient is a smart contract;
- a notice the first time you send to an address, because look-alike addresses are a common scam.

Every send needs the HENSENG password. After that, the status screen moves from Sending to Sent (or Failed) on its own, with an explorer link.

**Activity**

Sends made in HENSENG on this device are listed with live status. Tapping one opens it in the network's explorer. Incoming transfers show up in balances; a full history of incoming transfers needs an indexer, which comes in 3b.

**QR scanning**

- **Wallet → scan icon** (or **Scan** in Send) opens the camera.
- It reads plain addresses and EIP-681 payment links (address, network, token and amount).
- It explains links for other networks (for example Bitcoin) and refuses contract actions other than payments.
- A paste box works when there's no camera.

## Configuration

| Where | Variable | Notes |
|---|---|---|
| API (`apps/web`) | `COINGECKO_API_KEY` | Optional free "demo" key for higher price rate limits |
| App (`apps/app`) | `EXPO_PUBLIC_RPC_URL_<chainId>` | Optional RPC per network (1, 8453, 42161, 11155111, 84532). Public RPCs are rate-limited, so use your own for launch. The URL ships inside the app, so restrict the key to your domains and bundle IDs |

Native builds need a new development build for the camera (`eas build --profile development`). The camera permission text is set in `app.json`.

## Trying it safely

1. Turn on **Testnets** in the Wallet tab.
2. Get Sepolia ETH and test USDC from a faucet (Circle's faucet for USDC).
3. Send a small amount to a second wallet and watch it go from Pending to Confirmed.

## Files

| Path | What it is |
|---|---|
| `packages/wallet/src/tokens.ts` | Curated token list and ERC-20 ABI |
| `packages/wallet/src/payment.ts` | QR and payment-link parser, amount validation, fee padding (unit-tested) |
| `apps/web/lib/v1/prices.ts` | Price cache behind `GET /api/v1/prices` |
| `apps/app/src/wallet/use-portfolio.ts` | Balances, prices and USD total, shared app-wide |
| `apps/app/src/wallet/send.ts` | Builds transfers, estimates fees, explains errors |
| `apps/app/src/wallet/activity.tsx` | Local activity list with receipt polling |
| `apps/app/src/wallet/resolve-recipient.ts` | Address, ENS and @username lookup (shared with Chats) |
| `apps/app/src/app/send.tsx` | Send screen |
| `apps/app/src/app/scan.tsx` | QR scanner |

## Known limits

- **Hardware wallets and multiple accounts** aren't supported yet.
- **Speeding up or cancelling** a stuck transaction isn't supported yet.
- **Address book:** recipients are remembered only to drop the first-time notice. Naming contacts comes later.
- **Swap and bridge** are Phase 4.
