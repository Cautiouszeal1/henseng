# HENSENG Super App — Phase 1 (foundation)

The full plan is the doc *HENSENG Super App — Architecture, Design System & Roadmap*. This file records what Phase 1 delivers in code.

## Where it lives

| Path | What it is |
|---|---|
| `apps/app` | Expo SDK 58 app (Expo Router). One codebase for iOS, Android, web, and later the Chrome extension. |
| `packages/wallet` | Non-custodial wallet engine: BIP-39 phrases, Ethereum derivation, encrypted vault. Unit-tested. |
| `apps/web`, `packages/core`, `packages/db` | Existing HENSENG backend, fee engine and registry. They will become the super app's API. |

## Run it

```bash
pnpm install
pnpm app            # Expo dev server: press i (iOS), a (Android) or w (web)
pnpm app:web        # web only
pnpm app:build:web  # static web build in apps/app/dist
```

On a phone, install **Expo Go** and scan the QR code from `pnpm app`. For store builds use EAS: `npx eas-cli build -p ios|android`.

## What is real

- **Wallet creation and import.** A 12-word phrase is generated on the device from a secure random source. The user must confirm 3 words before the wallet is created. Import accepts 12 or 24-word phrases and gives precise error messages.
- **Encrypted vault.** Keys are derived with scrypt (N=2^15) and encrypted with AES-256-GCM. On iOS and Android the vault is stored in the Keychain or Keystore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); on web it is stored as ciphertext in local storage. The phrase is never stored unencrypted and never sent over the network.
- **Lock and unlock.** Unlock needs the password. The app locks automatically after 15 minutes idle or 60 seconds in the background, and on page reload.
- **Show recovery phrase.** Asks for the password again before revealing anything.
- **Remove wallet from this device.**
- **Live ETH balances** on Ethereum, Base and Arbitrum, plus Sepolia and Base Sepolia as an option, read directly from each network. The app never shows a total it could not read.
- **Receive.** QR code, copy address and an explorer link.
- **Explore.** A curated directory of real dApps that open in the in-app browser (HTTPS only), with bookmarks, recent visits and an incognito mode. All of it is stored on the device only.
- **Profile.** Display name, username, bio, cover and avatar colours, and privacy settings, saved on the device.
- **Dark and light themes.** Dark is the default.
- **Responsive layout.** Phone uses a bottom tab bar. Tablet and desktop use a sidebar, with a two-panel Chats layout.

## What is a labelled preview

Chats and Communities show sample data, with a visible "Preview" banner on every such screen. Messages typed in a preview chat stay on that screen only. These features arrive in Phase 2:

- XMTP end-to-end encrypted messaging;
- the communities API;
- notifications;
- profile sync, with usernames reserved on the server.

Send, swap and bridge open a sheet that says which phase brings them.

## Verified (14 Nov 2026)

- `@henseng/wallet`: 9 unit tests pass. They cover:
  - standard Ethereum derivation path test vectors;
  - wrong password and tampered ciphertext both rejected;
  - a fresh salt and nonce on every encryption;
  - no phrase words present in the stored vault.
- `tsc --noEmit` is clean for the app.
- `expo export -p web` succeeds.
- Browser end-to-end run of the exported web build at phone (390×844), tablet (834×1112) and desktop (1440×900) sizes:
  - create a wallet, confirm the phrase and set up a profile;
  - send a message in a preview chat;
  - open a community, the wallet and the receive sheet, Explore and Profile;
  - wrong password rejected, then the phrase revealed with the right one;
  - switch between light and dark themes;
  - lock and unlock.
- No app errors were found. The only browser errors were the RPC requests, which are blocked inside the test sandbox.

## Before store submission (Phase 6)

- Replace the placeholder bundle ID `xyz.henseng.app` in `app.json` with one based on a domain you own.
- Add a privacy policy URL.
- Complete App Store privacy labels and the Google Play Data safety form.
- Produce store screenshots.
- Get an independent security review of `packages/wallet` and of the extension.
