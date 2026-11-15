# Deploying HENSENG on Vercel

One Vercel project serves everything from one domain:
- `https://<site>/`: the HENSENG website (Next.js, `apps/web`), with the privacy page;
- `https://<site>/app`: the HENSENG web app (wallet, chats, communities, swap, bridge), built from `apps/app` on each deploy;
- `https://<site>/api/v1`: the API used by the web app, the phone apps and the Chrome extension.

Everything runs on **mainnet**: Ethereum, Base, Arbitrum and Solana, and XMTP's production network. Test networks only appear in builds made with `EXPO_PUBLIC_ENABLE_TESTNETS=1`, which the EAS `development` profile and the automated tests use.

## 1. Create the project
1. On vercel.com: **Add New → Project → Import** `Cautiouszeal1/henseng`.
2. **Root Directory: `apps/web`** (Edit → choose `apps/web`). Framework is detected as Next.js. Leave the build and install commands alone: `apps/web/vercel.json` sets the build.
3. Don't deploy yet; add the database and settings first.

## 2. Database
Project → **Storage → Create Database → Neon (Postgres)** → connect it to this project for all environments. This sets `DATABASE_URL`.
Each deploy applies migrations and the safe registry seed (chains and providers, all disabled; never users or activity).

## 3. Environment variables (Settings → Environment Variables)
| Name | Needed | Value |
|---|---|---|
| `SESSION_SECRET` | yes | 40+ random characters (password manager, or `openssl rand -base64 36`) |
| `DATABASE_URL` | yes | set by step 2 |
| `NEXT_PUBLIC_SITE_URL` | recommended | your production URL, e.g. `https://henseng.vercel.app`. Defaults to the project's production domain. Sign-in only works on this domain. |
| `ALCHEMY_API_KEY` | recommended | transaction history and NFTs (alchemy.com, free tier) |
| `EXPO_PUBLIC_RPC_URL_101` | recommended | a Solana mainnet RPC, e.g. Helius `https://mainnet.helius-rpc.com/?api-key=…`. The public Solana RPC often refuses browser requests. |
| `EXPO_PUBLIC_RPC_URL_1`, `_8453`, `_42161` | recommended | Ethereum, Base, Arbitrum RPCs (e.g. Alchemy). Without them the public RPCs are used, which are rate-limited. |
| `NEXT_PUBLIC_LEGAL_ENTITY`, `NEXT_PUBLIC_PRIVACY_EMAIL` | before launch | shown on /privacy |
| `COINGECKO_API_KEY`, `LIFI_API_KEY`, `LIFI_INTEGRATOR`, `SWAP_FEE` | optional | higher price/quote limits; swap fee |
| `ADMIN_BOOTSTRAP_ADDRESSES` | optional | your wallet address, for the website's admin area |

`EXPO_PUBLIC_*` values are built into the web app and visible in the browser: restrict those keys to your domain in the provider's dashboard.

## 4. Deploy and test
Deploy. Then open **the production URL** (not a per-deployment preview URL; sign-in is tied to `NEXT_PUBLIC_SITE_URL`):
- `/` website, **Open app** → `/app`;
- import or create a wallet → Chats (XMTP production), Wallet (real balances), Swap/Bridge (real quotes), Explore (dApps open in a new tab on web);
- `/api/health` → `ok` once the database is connected.

Use small amounts: this is real money on mainnet.

## 5. Phones and the Chrome extension
Point them at the deployed API:
- EAS: `eas env:create --name EXPO_PUBLIC_API_URL --value https://<site> --environment preview` (and production), plus the `EXPO_PUBLIC_RPC_URL_*` values; then `eas build --profile preview --platform android`.
- Extension: `EXPO_PUBLIC_API_URL=https://<site> pnpm --filter @henseng/app build:extension`.
