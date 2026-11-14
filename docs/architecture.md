# HENSENG architecture

The full Phase 0 plan (audit, integrations and costs, MVP milestones, risks) is in the project doc "HENSENG — Phase 0: Audit, Architecture & MVP Plan". This file records the decisions that shape the code.

## Shape

- **apps/web**: Next.js App Router. Its API route handlers are kept thin: they validate input, check auth and RBAC, call `packages/core`, and write through Prisma.
- **apps/worker** (Phase 2): a long-running Node process for receipt verification, bridge status polling, indexing and analytics snapshots, using BullMQ on Redis. It is hosted outside Vercel.
- **packages/core**: pure logic with no I/O. Anything that decides money, points or eligibility lives here and is unit-tested.
- **packages/db**: the Prisma 7 schema and client. It uses the `@prisma/adapter-pg` driver adapter, which works with Neon and local Postgres alike.

## Authentication

Sign-In with Ethereum (EIP-4361) works as follows:

1. `GET /api/auth/nonce` stores a single-use nonce that expires after 10 minutes.
2. The wallet signs a message whose domain and URI must match `NEXT_PUBLIC_SITE_URL`.
3. `POST /api/auth/verify` checks the fields, consumes the nonce atomically, and verifies the signature. Verification goes through RPC, so smart-contract wallets (ERC-1271 / ERC-6492) also work.
4. It then creates a server-side `sessions` row, and an iron-session cookie (httpOnly, SameSite=Lax) carries only the session ID.
5. Logout revokes the row.

**CSRF:** state-changing routes require an `Origin` header that matches the site.

**Rate limits:** in-memory per instance in Phase 1. These move to Redis in Phase 2.

## Admin and RBAC

The roles are Super Admin, Operations Admin, Campaign Manager, Analyst and Read-only Admin. Permissions are defined in `packages/core/src/rbac.ts` and checked on the server for every admin page and API call. Every change writes an `admin_audit_logs` row in the same transaction.

**Planned for Phase 2:** a TOTP step-up for sensitive actions (fees, roles, provider keys).

## Registry and "supported"

- `chains.enabled` is an admin switch.
- `chain_provider_support` holds each provider candidate per chain. `verifiedAt` is set only after an integration test on that chain passes.
- **A chain is publicly live only when** the chain is enabled, a provider row is enabled, that row is verified, and the provider itself is enabled.

## Fees

`fee_configurations` rows are versioned and immutable. The only change allowed is closing a row out with `activeTo` or `enabled`; a database trigger enforces this. Rates are stored in centi-bps, with a database CHECK and a code ceiling of 5%.

The engine (`packages/core/src/fees.ts`) does all arithmetic in bigint base units, rounds down, and picks the most specific active configuration. Phase 2 and 3 quotes store the configuration ID and version they used, so the quote and the executed transaction always match.

## Data honesty

Public metrics are typed as `available` (with value, as-of time and provenance) or `unavailable` (with a reason). There is no third state, so a placeholder number cannot be displayed by accident.

## Wallet layer notes

RainbowKit pulls in the Base Account connector, which depends on `@coinbase/cdp-sdk`. That SDK has optional `@x402/*` payment peers that HENSENG never uses. `apps/web/next.config.ts` aliases them to `stubs/empty-module.js`, whose exports throw if called. If RainbowKit or wagmi drop this dependency in a future release, remove the alias.
