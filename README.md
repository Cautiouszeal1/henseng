# HENSENG

**Your Web3 super app.** Private chat, communities, a non-custodial multi-chain wallet, swap and bridge, and a dApp browser, for iOS, Android, web and Chrome.

> **Super app status: Phase 1 (foundation).** It has a real wallet (create, import, encrypted vault, lock/unlock), live balances, a dApp explorer, a profile and themes. Chats and communities are labelled previews until Phase 2. See `docs/super-app-phase-1.md`.
>
> **Phase 2a:** live communities, synced profiles, devices and notifications on the HENSENG API (`/api/v1`). See `docs/super-app-phase-2a.md`.
>
> Run the app with `pnpm app` (Expo). Set `EXPO_PUBLIC_API_URL` in `apps/app/.env.local` to connect it to the API in `apps/web`.

## Backend: swap and bridge aggregator (`apps/web`)

Status: **Phase 1 (foundation)**. Swapping and bridging are not live. Every unfinished feature is clearly labelled in the UI.

## What is in this repository

| Path | What it is |
|---|---|
| `apps/web` | Next.js 16 (App Router) web app and API routes: homepage, chains, analytics, docs, wallet sign-in, admin |
| `packages/core` | Framework-free domain logic: fee engine, registry validation, RBAC, metric types. Fully unit-tested. |
| `packages/db` | Prisma 7 schema, migrations and safe seed data (PostgreSQL / Neon) |
| `docker/` | Local Postgres and Redis |
| `docs/` | Architecture, deployment and phase notes |

## Requirements

- Node.js 20.18+ (22 recommended)
- pnpm 10 (`npm install -g pnpm@10`, or `corepack enable`)
- A PostgreSQL database: Neon for staging and production, or Docker locally

## Run it locally

```bash
pnpm install
cp .env.example .env                       # then fill in values (see below)
cp .env apps/web/.env.local
cp .env packages/db/.env

docker compose -f docker/docker-compose.yml up -d   # skip if using Neon
pnpm db:deploy                             # apply migrations
pnpm db:seed                               # registry metadata only, everything disabled
pnpm dev                                   # http://localhost:3000
```

On Windows PowerShell, use `Copy-Item .env apps/web/.env.local` and so on in place of `cp`.

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon: use the **pooled** connection string with `?sslmode=require` |
| `SESSION_SECRET` | yes | 32+ random characters. Generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_SITE_URL` | yes | Exact public origin, e.g. `https://henseng.xyz`. Sign-in messages are checked against it. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | recommended | From dashboard.walletconnect.com (free). Without it, only browser wallets and Coinbase Wallet appear. |
| `ADMIN_BOOTSTRAP_ADDRESSES` | first run | Comma-separated wallets that become Super Admin on first sign-in |
| `RPC_URL_<chainId>` | optional | Server-side RPC (Alchemy/QuickNode). Public RPCs are used if empty. |

### Becoming the first admin

1. Put your wallet address in `ADMIN_BOOTSTRAP_ADDRESSES`.
2. Open `/admin/sign-in`, connect that wallet and sign in.
3. You are now Super Admin, and the grant is recorded in the audit log. Remove the address from the variable afterwards if you like; the role stays.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run the web app in development |
| `pnpm build` | Type-check packages and build the web app |
| `pnpm test` | Run all unit tests |
| `pnpm typecheck` | TypeScript across the workspace |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | Create a new migration after editing `schema.prisma` (development only) |
| `pnpm db:deploy` | Apply migrations (staging/production) |
| `pnpm db:seed` | Seed registry metadata (safe to run repeatedly) |

## Deploying to Vercel + Neon

1. Create a Neon project and copy the pooled connection string.
2. Import this repo in Vercel and set **Root Directory** to `apps/web`. Vercel detects pnpm and the workspace automatically.
3. Add the environment variables above in Vercel (Production and Preview).
4. Run migrations against Neon from your machine before the first deploy: `DATABASE_URL=… pnpm db:deploy && pnpm db:seed`.
5. Push to `main`. Vercel builds and deploys.

## Principles this codebase enforces

- Never fabricate users, volume, transactions or analytics. Metrics without data show "Data not yet available".
- A chain only shows as **live** when it is enabled **and** a provider integration on it is enabled **and** verified.
- Testnet and mainnet records carry an `environment` column and are never combined.
- Audit logs are append-only, enforced by a database trigger. Fee configurations are versioned and immutable, also enforced in the database.
- No private keys, seed phrases or provider API keys ever reach the browser.

See `docs/architecture.md` for the full design and `docs/phase-1.md` for what is done and what is next.
