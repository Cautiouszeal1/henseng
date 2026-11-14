# HENSENG Super App — Phase 2a: communities, profiles, notifications

Phase 2 is split in two halves:

- **2a (this document):** everything that runs on HENSENG's own server. It has been tested end to end.
- **2b (next):** end-to-end encrypted private chats over XMTP.

## What's live

**Accounts**

- The app signs in with the user's own wallet using Sign-In with Ethereum.
- It receives a 30-day session token. Only a SHA-256 hash of the token is stored on the server.
- Each signed-in phone, browser or extension appears under **Profile → Devices**, and any of them can be signed out remotely.

**Profiles**

- Usernames are unique across HENSENG, and reserved names are refused.
- Display name, bio, avatar colour, cover and online status sync across devices.
- The profile a user sets up during onboarding is published the first time they connect.

**Communities**

- Communities are public or private. Private ones need a 7-day invite link, valid for up to 50 people.
- Every new community gets #announcements, where only admins can post and members are notified, and #general.
- Roles are owner, admin, moderator and member. Permission rules live in `packages/core/src/community.ts` and are unit-tested:
  - only someone who outranks a person can moderate them;
  - nobody can touch the owner;
  - role changes are capped below the actor's own role.
- Moderators can delete messages and remove and ban members. Banned users can't rejoin.
- Any message can be reported.
- New messages appear live through 4-second polling while a channel is open.
- Community channels are **not end-to-end encrypted**, and the app says so in each channel header and in the create form.

**Notifications:** announcements and role changes appear with an unread badge on the bell, and are marked read when opened.

## API

All endpoints are under `/api/v1` on `apps/web`, in `lib/v1/router.ts` and `lib/v1/handlers.ts`.

- **Auth:** bearer tokens only, so CORS is open and CSRF does not apply.
- **Rate limits** apply to sign-in, posting messages (20 per 10 seconds), creating communities (5 per hour) and reports.
- **New tables** come in the migration `20261114200000_super_app_social`: profiles, app_tokens, communities, community_members, community_channels, channel_messages, community_invites, community_bans, notifications and reports.

## Run it

```bash
# API + database (see README for Neon / Docker setup)
pnpm db:deploy && pnpm --filter @henseng/web dev        # http://localhost:3000

# App connected to it
echo 'EXPO_PUBLIC_API_URL=http://localhost:3000' > apps/app/.env.local
pnpm app
```

On a real phone, use your computer's LAN IP, or the deployed API URL, rather than `localhost`. Leaving `EXPO_PUBLIC_API_URL` empty builds an offline app in which Communities shows the labelled preview.

## Verified (14 Nov 2026)

- **Unit tests:** 24 core tests (including the community permission rules), 9 wallet tests and 7 web tests pass.
- **API end-to-end** (`apps/web/tests/api-v1.e2e.mjs`): 44 of 44 checks pass with three throwaway wallets against PostgreSQL 17.
- **Browser end-to-end:** two wallets ran in two browsers, one at phone size and one at desktop size. 11 of 11 checks passed and the app logged 0 errors:
  - both connect automatically;
  - a duplicate username is refused;
  - a community is created;
  - the second wallet discovers it and reads it before joining, then joins and posts;
  - the owner sees that message live;
  - the owner posts an announcement;
  - the member can't post announcements and gets a notification;
  - the owner promotes the member to moderator;
  - the device list shows.

## Not yet

- **Private 1:1 and group chats (XMTP):** Phase 2b.
- **Push notifications to the phone lock screen** (Expo push with APNs/FCM): needs a development build and store credentials.
- **Real-time sockets:** polling is used for now; WebSocket or SSE comes with the worker in a later phase.
- **Photo uploads** for avatars and community banners: needs object storage.
