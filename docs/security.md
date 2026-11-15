# Device security and data safety

What HENSENG does to protect a user's keys and data on their device. Everything here is implemented and tested; see "How it was tested".

## Keys
- The recovery phrase is encrypted with the user's password (scrypt N=2^15 + AES-GCM) before it is stored. On iOS/Android it lives in the system keychain/keystore (`expo-secure-store`); Android app backups are disabled.
- The decrypted phrase is held only in memory while unlocked. The wallet auto-locks after 15 minutes idle and after a short grace period in the background. The phrase is never copied to the clipboard.

## Password guessing (`apps/app/src/wallet/unlock-guard.ts`)
- 5 free attempts; after that each attempt waits 30 s, doubling to a 15-minute cap. The counter persists across restarts and resets on a correct password.
- Applies everywhere a password is checked: unlock, reveal phrase, send (EVM and Solana), swap/bridge, account deletion.
- Limits on-device guessing only; offline attacks on a copied vault are slowed by scrypt.

## Screens with secrets (`apps/app/src/ui/privacy.tsx`)
- `NoScreenCapture` blocks screenshots/recording (iOS/Android) on: new-wallet phrase, import, and reveal phrase in Profile. The import field also turns off autocorrect, spellcheck, autofill and keyboard suggestions.
- `AppSwitcherShield` covers the app with a plain logo screen whenever it leaves the foreground (native).

## Removing the wallet (`apps/app/src/wallet/device-wipe.ts`)
Providers register wipe steps with `onDeviceWipe`. `removeWallet` runs them all, then deletes the vault. It erases:
- XMTP chat database: deleted via the SDK on native and its encryption key removed from secure storage; on web/extension the browser's private file storage (OPFS) is emptied.
- API sign-in token, profile, activity, added tokens, read markers, browser history, unlock counter (every `henseng.*` key in AsyncStorage/localStorage).
- In-memory state (balances, profiles, chats).

## Server
- Bearer tokens expire after 30 days and are stored hashed; responses are `Cache-Control: no-store`; security headers are set in `next.config`.
- Rate limiting keys on the platform-provided client IP (`x-vercel-forwarded-for` / `x-real-ip`), not the client-settable first `x-forwarded-for` entry.

## dApp browser
See `dapp-browser.md`: per-site connection, approval for every signature and transaction, password for transactions and permits, `eth_sign` refused, iframes can't impersonate the site, https only.

## Token logos
- Logos for the curated tokens and networks are bundled in the app (`apps/app/src/wallet/logos.ts`, from @web3icons/core, MIT; see `third-party-notices.md`). Nothing is fetched from token-supplied URLs.
- A logo shows only when chain **and** contract address match the curated list. A token that copies a name like "USDC" from another address gets a plain letter and an "Unverified" label.

## How it was tested
Browser test (`wipe.py`): imported a wallet, added a token, planted a file in OPFS, made 5 wrong unlock attempts (wait enforced, survives reload), removed the wallet → zero `henseng.*` keys and empty OPFS; re-import starts clean. Regression suites: chats 32/32, send 27/27, Solana/NFT/history 26/26, swap/bridge 21/21, extension 12/12, account deletion 3/3, unit tests 76/76, plus the native Android bundle build.

Not testable here: screenshot blocking and the app-switcher cover need a real phone (use the preview APK).
