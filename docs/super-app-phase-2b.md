# HENSENG Super App — Phase 2b: end-to-end encrypted chats (XMTP)

Phase 2b replaces the chat preview with real private messaging over [XMTP](https://xmtp.org), an open, end-to-end encrypted messaging network (MLS). HENSENG's servers never see message contents. Messages go directly between devices over the XMTP network, and anyone with an XMTP-enabled wallet can be reached, in HENSENG or in another XMTP app.

## Status: what was tested, and what wasn't

| | Status |
|---|---|
| Chat UI (list, thread, requests, new chat, groups, replies, reactions, read ticks) | Tested end to end in the browser, wide and phone layouts, against a simulated client (32/32 checks) |
| Web: XMTP WebAssembly engine and worker load | Tested. The client starts and fails only at its first network call, because XMTP's servers are blocked in the build sandbox |
| Web: timeout and error state when XMTP is unreachable | Tested |
| iOS and Android JavaScript bundles | Build cleanly |
| **Real message delivery over XMTP** | **Not yet verified.** It needs a device or browser that can reach XMTP's network. See "How to test it" below |
| **Native builds** | **Not yet built.** They need EAS (Expo's build service); Expo Go can't load XMTP's native module |

## What's in it

**Chats tab**

- Inbox with filters for All, Unread and Groups, plus search by name, @username, address or message text.
- A separate **Requests** list. Messages from people the user hasn't chatted with land there. They can **Accept** or **Block**, and senders see no read receipts until the user accepts.
- **New chat** works with a wallet address, an ENS name (for example `name.eth`) or a HENSENG `@username`. Before opening a chat, the app checks that the person can receive XMTP messages, and says so plainly if they can't.
- **New group** has a name and any number of members. Only admins can change group settings.
- Names come from HENSENG profiles when the person has one; otherwise the app shows a short address.
- Unread dots and the tab badge count real unread chats.
- On wide screens (desktop, tablet and the extension), the list and the open chat sit side by side.

**Conversation**

- Text messages, replies, and emoji reactions (tap to add, tap again to remove).
- Long-press a message on phones; on web, use the smiley button beside each message.
- Read receipts in one-to-one chats. Two ticks turn blue when the other person has read the message. Users can turn read receipts off under Profile → Privacy.
- New messages arrive live, with no refresh needed.
- **Safety** (shield icon) explains the encryption and lets the user **report** or **block** a chat. A report sends HENSENG only the chat partner's address and a reason, never message contents.

**Keys and storage**

- XMTP identity is created by signing a message with the user's own wallet key, on the device. The key never leaves the device.
- On iOS and Android, XMTP's local message database is encrypted with a random 32-byte key kept in the device's secure storage (Keychain / Keystore), one key per wallet.
- On web and the extension, XMTP keeps its database in the browser's private storage (OPFS) inside a Web Worker.

## Configuration

`apps/app/.env.local`:

| Variable | Values |
|---|---|
| `EXPO_PUBLIC_XMTP_ENV` | `dev` (XMTP's test network), `production`, or empty to keep the labelled chat preview |
| `EXPO_PUBLIC_XMTP_CONNECT_TIMEOUT_MS` | Optional. How long to wait for XMTP before showing an error (default 45 000) |

`memory` is also accepted. It turns on a **simulated, unencrypted** in-memory client used for automated UI tests and screenshots. The app shows a "Test mode" banner and labels each chat "not encrypted" while it's on. **Never ship a build with it.**

`apps/app/eas.json` sets `dev` for the development and preview builds and `production` for store builds.

## How to test it

**Web (quickest)**

```bash
cd apps/app
EXPO_PUBLIC_XMTP_ENV=dev pnpm build:web     # exports, then copies XMTP's .wasm next to the bundles
npx serve dist                               # any static server; .wasm must be served as application/wasm
```

Open it in two different browsers (or one normal and one private window). Create or import a different wallet in each, then start a chat from one to the other's address.

`pnpm build:web` runs `scripts/copy-xmtp-wasm.mjs` after the export, and that step is required. It copies `bindings_wasm_bg.wasm` (12.7 MB) next to the JS bundles, and it patches Expo's `import.meta` polyfill into the XMTP worker chunks; without the patch, the worker crashes.

**iPhone and Android**

```bash
npm install -g eas-cli
cd apps/app
eas login
eas build --profile development --platform ios       # or android
```

Install the build on the phone, run `pnpm app`, and open the project in the development build, not in Expo Go.

## Files

| Path | What it is |
|---|---|
| `apps/app/src/messaging/model.ts` | Platform-neutral chat types, the `MessagingClient` interface, unit-tested helpers |
| `apps/app/src/messaging/xmtp.ts` | iOS/Android adapter (`@xmtp/react-native-sdk`) |
| `apps/app/src/messaging/xmtp.web.ts` | Web and extension adapter (`@xmtp/browser-sdk`) |
| `apps/app/src/messaging/messaging-context.tsx` | Connects on unlock, streams messages, resolves ENS/@usernames, tracks read state |
| `apps/app/src/messaging/memory-client.ts` | Test-only simulated client |
| `apps/app/src/features/chats-live.tsx` | Chats list, requests, new chat and new group |
| `apps/app/src/features/chat-thread-live.tsx` | Conversation screen |
| `apps/app/src/features/chats-preview.tsx` | The labelled preview, shown when XMTP is off |
| `apps/web/lib/v1/handlers.ts` | New `POST /api/v1/profiles/lookup` (addresses → HENSENG profiles); reports accept `targetType: "chat"` |

## Known limits

- **Attachments** (images and files) and **voice notes** aren't in this phase.
- **Push notifications** for new messages need an XMTP push server and Apple/Google push setup; they're planned for a later phase. For now, messages arrive while the app is open.
- The Chrome extension package itself (manifest and popup) is still to come. The web build it will use already runs XMTP.
- Group management after creation (renaming, adding and removing members) isn't built yet.
