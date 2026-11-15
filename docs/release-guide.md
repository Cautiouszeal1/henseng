# Releasing HENSENG: Chrome Web Store, App Store, Google Play

This is the checklist for getting HENSENG into the three stores. The code side is done (Phase 5). What's left are accounts, keys, store listings and review answers that only you can provide.

## 0. Before any store

1. **Deploy the API** (`apps/web`) to a public HTTPS URL, with production settings:
   - `DATABASE_URL`;
   - `NEXT_PUBLIC_SITE_URL`;
   - `ALCHEMY_API_KEY`;
   - optionally `LIFI_API_KEY`, `LIFI_INTEGRATOR` and `SWAP_FEE`, and `COINGECKO_API_KEY`.
2. **Set who operates HENSENG**, which the privacy page shows and every store requires:
   - `NEXT_PUBLIC_LEGAL_ENTITY` (your registered company name);
   - `NEXT_PUBLIC_PRIVACY_EMAIL`.

   Then open `https://<your-site>/privacy` and read it once.
3. **Set the app's production settings** in `apps/app/.env.local` or in EAS environment variables:
   - `EXPO_PUBLIC_API_URL` = your API URL;
   - `EXPO_PUBLIC_XMTP_ENV=production`;
   - `EXPO_PUBLIC_RPC_URL_<chainId>` for Ethereum (1), Base (8453), Arbitrum (42161) and Solana (101), from providers such as Alchemy and Helius. Restrict each key to your domains and app IDs.
4. **Test on real networks with small amounts:** a send, a swap on Base, a bridge, a devnet Solana send, and a chat between two devices.

## 1. Chrome Web Store

**Build**

Run `pnpm --filter @henseng/app build:extension` with the production `EXPO_PUBLIC_*` variables set. It produces:
- `apps/app/dist-extension/`, to try it yourself: open `chrome://extensions`, turn on Developer mode, choose "Load unpacked";
- `apps/app/dist-extension.zip`, to upload.

**How it works**

- Clicking the toolbar icon opens HENSENG in Chrome's side panel, using the phone layout.
- Keys exist only in that panel's memory, so closing it locks the wallet.
- It requests one permission, `sidePanel`, and no access to websites.

**Developer dashboard (one-time $5 registration)**

- **Single purpose:** "A self-custody crypto wallet with encrypted chat and communities, opened in Chrome's side panel."
- **Permission justification (`sidePanel`):** "Shows the HENSENG app in Chrome's side panel when the toolbar icon is clicked."
- **Remote code:** No. All code, including the XMTP WebAssembly module, is inside the package.
- **Data usage** (match the privacy policy; tick what applies):
  - "Financial and payment information" (wallet address, transactions);
  - "Personal communications" (community posts);
  - "Personally identifiable information" (username or display name, if you treat it as such).
  - Certify no sale of data and no unrelated use.
- **Privacy policy URL:** `https://<your-site>/privacy`.
- **Screenshots:** 1280×800 or 640×400. Capture the side panel over a normal web page.

## 2. Google Play

1. **Create the app** in the Play Console (one-time $25 developer account). Package name: `xyz.henseng.app`. Change it in `apps/app/app.json` before the first upload if you want a different one; it can never be changed afterwards.
2. **Build:**
   ```bash
   cd apps/app && npx eas-cli login && npx eas-cli build --profile production --platform android
   ```
3. **Upload:** `npx eas-cli submit --platform android` (it uploads to the internal track as a draft). It asks for a Google service-account key the first time; Expo's docs show how to create one.
4. **App content forms:**
   - **Data safety:**
     - Collected: wallet address, username and display name (optional), community messages, device type.
     - Not sold. Encrypted in transit. Deletion: users can delete in the app.
     - Private chats are end-to-end encrypted and not collected.
   - **Financial features:** declare "cryptocurrency wallet (non-custodial)".
   - **Target audience:** 18+ is simplest for a crypto app.
   - **User-generated content:** yes, with in-app reporting and blocking. Both exist: report and block in chats, and moderation, bans and reports in communities.
5. **Account deletion URL:** Play asks for a web link too. Point it to `https://<your-site>/privacy` (it explains in-app deletion), or add a dedicated page later.
6. **Review:** when the internal test is good, promote it to closed testing, then production. Google requires new *personal* developer accounts to run a closed test with a minimum number of testers for 14 days before production; check the Play Console for the current numbers. Organization accounts are exempt.

## 3. Apple App Store

> ⚠️ **Enroll as an organization, not as an individual.** Apple's crypto rule says "Wallets: Apps may facilitate virtual currency storage, provided they are offered by developers enrolled as an organization." You need a registered company and a D-U-N-S number. Use the legal entity that operates HENSENG.
>
> ⚠️ **Swaps and bridges** may be reviewed under the exchange rule. Since its 2022 revision, Apple says "Exchanges: Apps may facilitate transactions or transmissions of cryptocurrency on an approved exchange, provided they are offered only in countries or regions where the app has appropriate licensing and permissions to provide" that service. Developers report Apple asking for "information on the third-party exchange APIs that your app connects with, including links to public APIs and documentation of partnership with specific third-party exchanges". Prepare to explain that swaps are non-custodial, run through LI.FI's on-chain contracts, and are signed by the user. Get legal advice on which countries to offer the app in. I'm not a lawyer, and this isn't legal advice.

1. **Create the app** in App Store Connect (Apple Developer Program, $99/year). Bundle ID: `xyz.henseng.app`.
2. **Build:** `npx eas-cli build --profile production --platform ios`. EAS manages certificates for you.
3. **Upload:** `npx eas-cli submit --platform ios`. Try it in TestFlight first.
4. **App Privacy ("nutrition label")**, same facts as the privacy policy:
   - **Collected and linked to the user:** User ID (wallet address), Name (display name, optional), Other User Content (community posts).
   - **Not collected:** contacts, location, private messages, browsing history.
   - **No tracking.**
5. **Export compliance:** the app uses standard encryption (TLS; XMTP's audited end-to-end encryption; AES-GCM for the local vault). App Store Connect asks about this on upload. Answer it for your company, since it's a legal declaration. Most apps that use only standard encryption qualify for the exemption, but confirm with your advisor.
6. **Notes for App Review**, which Apple expects ("provide full access"):
   - Explain that it's a non-custodial wallet: the reviewer can create a new wallet in the app; no login is needed.
   - Say that community features use a wallet signature as sign-in.
   - Mention that account deletion is in Profile → Danger zone → Delete HENSENG account.
   - Point out that user-generated content has reporting and blocking (chats: shield icon → Report or Block; communities: report, moderators and bans).
7. **Age rating:** choose the answers for unrestricted web access (the dApp browser opens HTTPS sites) and user-generated content. The result is usually 17+.

## Store listing text (edit to taste)

**Name:** HENSENG

**Subtitle / short description (≤ 30 / 80 characters):** Encrypted chat & self-custody wallet / Private chats, communities and a non-custodial wallet for Ethereum, Base, Arbitrum and Solana.

**Description:**

> HENSENG brings your crypto and your conversations together, and keeps both yours.
>
> PRIVATE CHATS — Message any wallet address, ENS name or HENSENG username. Chats are end-to-end encrypted with XMTP, so only you and the people you talk to can read them. New contacts arrive as requests you can accept or block.
>
> COMMUNITIES — Create or join communities with channels, announcements, roles and moderation tools. Public channels are clearly marked as not end-to-end encrypted.
>
> SELF-CUSTODY WALLET — One recovery phrase for Ethereum, Base, Arbitrum and Solana. Your keys stay on your device, encrypted with your password. HENSENG never holds your funds.
>
> SEND, SWAP AND BRIDGE — Send tokens with clear checks before you sign. Swap and bridge with quotes from LI.FI, every fee shown up front, exact-amount approvals and price protection.
>
> HISTORY AND NFTS — See incoming and outgoing transfers and your NFTs, with spam filtered out.
>
> HENSENG doesn't sell your data or show ads. You can delete your HENSENG account at any time from the app.

**Keywords (Apple, 100 characters):** crypto wallet,encrypted chat,xmtp,ethereum,base,arbitrum,solana,web3,defi,swap,bridge,nft

**Category:** Finance (primary), Social Networking (secondary).

Sources for the Apple rules quoted above: App Store Review Guidelines §3.1.5, as reported by [Apple's October 2022 update notice](https://apple.co/3z61NuT), [ConductAtlas](https://conductatlas.com/platform/apple/apple-app-store-review-guidelines/provision/CA-P-018935/crypto-wallet-apps-require-organization-developer-enrollment/) and the [Apple Developer Forums](https://developer.apple.com/forums/thread/751571). Always check the live guidelines at developer.apple.com before submitting.

## What each store review usually asks, and where HENSENG answers it

| Question | Where |
|---|---|
| Can users delete their account? | Profile → Danger zone → Delete HENSENG account (also `DELETE /api/v1/me`) |
| Can users report or block abusive content? | Chats: shield icon → Report or Block; message requests. Communities: report, moderator delete, bans |
| Where is the privacy policy? | `/privacy` on your site |
| Why the camera? | QR scanning only (the permission text says so) |
| Is code downloaded at runtime (Chrome)? | No |
