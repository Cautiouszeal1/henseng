# In-app dApp browser

dApps from Explore (and any https link typed into Explore's search) open inside HENSENG on iOS and Android, with the HENSENG wallet available to the site, the way MetaMask Mobile and Trust Wallet work.

## How a site talks to the wallet
- `src/dapp/provider-script.ts` is injected into the **main frame only**, before the page's scripts. It exposes an EIP-1193 provider as `window.ethereum` (`isHenseng: true`) and announces it through EIP-6963, so RainbowKit, wagmi, Web3Modal and similar connectors list "HENSENG". It doesn't pretend to be MetaMask.
- Requests travel through `ReactNativeWebView.postMessage` with a random per-session secret held in a closure. Cross-origin iframes inside a site (ads, widgets) can't read it, so they can't make requests in the parent site's name.
- The site's identity is the origin of the URL the WebView reports, never anything the page says about itself. Only https pages get a wallet; http and other app schemes (`wc:`, `intent:` …) are blocked.

## What each request does (`src/dapp/bridge.ts`)
| Request | Behaviour |
|---|---|
| `eth_requestAccounts` | Connect sheet naming the site. Connection is remembered per origin until disconnected (site menu ⋯ → Disconnect). |
| `eth_accounts` | Address only for connected sites. |
| `wallet_switchEthereumChain` | Asks first. Supported: Ethereum, Base, Arbitrum, Sepolia, Base Sepolia; others get 4902. The chosen network is remembered per site, and the user can change it from the network chip. |
| `personal_sign` | Shows the message as text (hex if it isn't valid UTF-8). Tap to sign. |
| `eth_signTypedData_v4/v3` | Shows the app, contract and data. Permit-style signatures get a red warning and need the password. Must match the selected network. |
| `eth_sendTransaction` | Simulated first (fee shown; if it would fail, Confirm stays disabled). ERC-20 `approve` is decoded and unlimited approvals are flagged. Needs the password, like Send. Logged in wallet activity as "Transaction on <site>". |
| `eth_sign` | Always refused (blind hash signing). |
| read-only RPC (`eth_call`, `eth_getBalance`, `eth_estimateGas`, logs, receipts …) | Forwarded to the network's RPC. Anything else gets 4200. |

Rejections return EIP-1193 code 4001. Contract deployment from a site isn't supported. Wrong-password throttling applies (see `security.md`).

## Platforms
- **iOS/Android**: `react-native-webview` (`src/dapp/dapp-webview.tsx`): no file access, no popups, no mixed content, debugging only in dev builds.
- **Web and Chrome extension**: sites refuse to be embedded, so dApps open in a normal tab (the explanation is shown in Explore). Making the extension inject its wallet into normal tabs would need access to every site and is a separate decision.
- `EXPO_PUBLIC_DAPP_IFRAME_TEST=1` (test builds only) swaps the WebView for an iframe so the whole flow can be tested in Chrome against a local test page.

## Not yet
- Solana dApps (Wallet Standard provider): EVM only for now.
- WalletConnect (connecting HENSENG to dApps open on a computer).

## Tests
- `src/dapp/bridge.test.ts`: 19 unit tests, including a transaction mined on a local chain and signatures verified with viem.
- End-to-end in Chrome (test build): EIP-6963 discovery, address hidden before connecting, an attacker iframe blocked, connect, network switch, a readable signed message that verifies, `eth_sign` refused, unlimited approval warned and rejected (4001), permit with wrong then right password, a 0.01 ETH transaction mined, disconnect, activity entry: 22/22.
- Not testable here: the real WebView on a phone. Install a new preview build (the WebView is a new native module).
