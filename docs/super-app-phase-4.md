# HENSENG Super App — Phase 4: Swap and Bridge

Swap tokens on one network, or bridge them to another, across Ethereum, Base and Arbitrum. Quotes come from [LI.FI](https://li.fi), which compares decentralised exchanges (Uniswap, 0x, 1inch and others) and bridges (Across, Stargate and others) and returns the best route. Everything is signed on the device; HENSENG never holds funds.

## Status

| | Status |
|---|---|
| Swap ETH → USDC, then USDC → ETH (with approval), on Base | Tested on local chains. A stand-in for LI.FI's contract sat at its real address. The swapped tokens were checked on-chain, and nothing was left approved afterwards |
| Bridge USDC Base → Arbitrum, tracked until arrival | Tested with two local chains and a fake LI.FI status service. The USDC arrived on local Arbitrum |
| Unsafe quote (transaction to an unknown contract) | Refused by the server, and by the app as a second check |
| High value loss (30%) | Warned, and Review stays disabled until you confirm |
| **Real LI.FI quotes and live mainnet swaps** | **Not yet tested.** The build sandbox can't reach LI.FI or mainnet. Try a small swap on Base first |

Test results: 21/21 for swap and bridge, 67/67 for the API, and 38 wallet unit tests (including 9 for the quote checks). The earlier send, Solana and chat suites still pass.

## How it protects users

Every quote is checked twice before anything is signed: once by the server and again by the app, which is the one that signs.

- **The contract:** the transaction must go to the LI.FI Diamond, `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE`. Per LI.FI's docs, this is their audited entry contract on Ethereum, Base and Arbitrum. The token approval must name the same contract.
- **Your choices:** the network, tokens, amount and sender must match what you entered, and the ETH value must equal the amount (or zero for token swaps).
- **The guaranteed minimum** must be above zero and no more than the expected amount.
- **Approvals are for the exact amount only, never unlimited.** After the approval confirms, the app fetches a fresh quote (as LI.FI recommends). If the price moved by more than 1%, it stops and asks you to review again.
- **Simulation:** every swap is simulated first, so one that would fail is caught before you pay a fee.
- **Value loss** (fees plus price impact) is shown as a percentage. Above 3% you get a warning; above 10% you must tick "I understand" before you can review.
- **Price protection (slippage):** 0.5%, 1% or 3%. If the price moves more than that, the swap is cancelled and only the network fee is spent.
- **Verified tokens only.** Tokens you added yourself, and testnets, aren't offered for swapping.
- **Quote expiry:** quotes refresh on their own before they expire (about a minute).
- **Bridges are followed until the funds arrive.** Refunds and "arrived as a different token" are explained. If a bridge reports nothing for 2 hours, the app stops checking and points to the explorer, and it never resends.

## What you see

- **Wallet → Swap or Bridge** opens one screen with a Swap/Bridge toggle.
  - "You pay": network, token, amount, Max.
  - "You get": token, plus the network in Bridge mode.
  - Quote details: rate, minimum you'll get, route, time, network fee, every fee (with whether it comes out of the amount), and value difference.
  - In Bridge mode, the "get" token follows the "pay" token (USDC → USDC).
- **Review:** you pay / you get, the steps ("approve exactly 25 USDC, then swap"), then your password.
- **Progress:** a checklist (approve, refresh quote, swap), then a status screen: Swapped, or Bridging → Arrived.
- **Activity** lists "Swapped ETH → USDC", "Bridged USDC to Arbitrum" (Arriving, then Confirmed) and "Allowed LI.FI to use USDC".

## Earning from swaps (optional)

1. Register an integrator at portal.li.fi.
2. Set `LIFI_INTEGRATOR`, and set `SWAP_FEE` (for example `0.0025` for 0.25%, capped at 3%).

LI.FI collects the fee for you, and it appears in each quote's fee list, so users always see it. It's off by default.

## Configuration

| Variable | Where | Notes |
|---|---|---|
| `LIFI_API_KEY` | API | Optional. Raises rate limits |
| `LIFI_INTEGRATOR`, `SWAP_FEE` | API | Optional HENSENG fee, shown to users |
| `LIFI_API_BASE` | API | Tests only |

## Files

| Path | What it is |
|---|---|
| `packages/wallet/src/swap.ts` | Quote safety checks, value loss, constants (unit-tested) |
| `apps/web/lib/v1/swap.ts` | `GET /api/v1/swap/quote` and `/swap/status` (LI.FI proxy, normalised and checked) |
| `apps/app/src/app/swap.tsx` | Swap and Bridge screen |
| `apps/app/src/wallet/activity.tsx` | Swap, approval and bridge entries, bridge tracking |

## Known limits

- **Solana swaps and bridges to or from Solana** aren't supported yet. They need versioned-transaction checks first.
- **Limit orders** and **gasless swaps** aren't supported.
- **Revoking an approval** isn't needed, because approvals are exact and get fully used. A manager for approvals made in other apps would be a later addition.
