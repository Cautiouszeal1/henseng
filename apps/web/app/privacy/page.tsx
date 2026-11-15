import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy" };

/**
 * Describes what the HENSENG apps (iOS, Android, Chrome extension, web) actually do with data.
 * Keep it in step with the code: if a feature starts storing or sharing something new, update this page.
 * Operator name and contact come from NEXT_PUBLIC_LEGAL_ENTITY and NEXT_PUBLIC_PRIVACY_EMAIL.
 */
const ENTITY = process.env.NEXT_PUBLIC_LEGAL_ENTITY;
const EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL;
const UPDATED = "15 November 2026";

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-12 text-xl font-semibold tracking-tight">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 leading-relaxed text-ink-muted">{children}</p>;
}
function L({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed text-ink-muted">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="mt-3 text-sm text-ink-faint">Last updated {UPDATED}</p>
      {!ENTITY || !EMAIL ? (
        <p className="mt-6 rounded-lg border border-rule p-4 text-sm text-ink-muted">
          Operator details are not configured. Set NEXT_PUBLIC_LEGAL_ENTITY and NEXT_PUBLIC_PRIVACY_EMAIL before publishing this page or submitting the apps.
        </p>
      ) : null}

      <P>
        This policy explains what data the HENSENG apps for iPhone, Android, Chrome and the web use, where it goes and how to delete it. HENSENG is
        operated by {ENTITY ?? "the HENSENG operator"}. Questions: {EMAIL ?? "contact address to be added"}.
      </P>

      <H>The short version</H>
      <L
        items={[
          "HENSENG is a self-custody wallet. Your recovery phrase and private keys are created and kept on your device, encrypted with your password. They are never sent to us or anyone else.",
          "Private chats are end-to-end encrypted with XMTP. We can't read them and don't store them.",
          "Community posts are not end-to-end encrypted: they're stored on our servers so members can read them, and the app says so.",
          "We don't sell data, show ads or track you across other apps or websites.",
          "You can delete your HENSENG account in the app at any time (Profile → Delete HENSENG account).",
        ]}
      />

      <H>What stays on your device</H>
      <L
        items={[
          "Your encrypted wallet (recovery phrase, protected by your password). On iPhone and Android it's held in the system's secure storage, and Android backups of the app are switched off.",
          "Your encrypted chat database (XMTP), list of sent transactions, tokens you added, read markers and settings.",
          "The wallet locks itself after 15 minutes of inactivity. After 5 wrong passwords in a row, each new attempt has to wait, starting at 30 seconds and growing to 15 minutes.",
          "On iPhone and Android, screens that show your recovery phrase block screenshots and screen recording, and the app hides its contents in the app switcher.",
          "Removing the wallet erases all HENSENG data on the device: the encrypted wallet, chat database and its key, activity, added tokens, profile, settings and your sign-in. Your funds stay on the blockchain and can be restored with your recovery phrase.",
        ]}
      />

      <H>What our servers store</H>
      <P>When you use social features, you sign in by signing a message with your wallet. Our servers then store:</P>
      <L
        items={[
          "Your wallet address, and the profile you choose: username, display name, short bio, avatar and privacy settings.",
          "Communities you create or join, your role in them, and the messages you post in community channels.",
          "In-app notifications, and the devices you've signed in on (device type and name you see in the app). Sign-in tokens are stored only as one-way hashes.",
          "Reports you send about chats, people or messages: the reason and what was reported. Reports about private chats contain the other person's address, never message content.",
          "Your IP address is used briefly to limit abuse (rate limiting) and appears in standard server logs.",
        ]}
      />

      <H>Services that receive data to make features work</H>
      <L
        items={[
          "Blockchain networks and their access providers (Ethereum, Base, Arbitrum, Solana). Your app reads balances and sends signed transactions directly to them. Transactions are public by nature of blockchains.",
          "XMTP network: carries your end-to-end encrypted chats and knows your wallet address as your chat identity.",
          "Alchemy (through our servers): your own wallet address, to show your transaction history and NFTs.",
          "LI.FI (through our servers): your address and the swap or bridge you ask for, to return quotes and track transfers. Transactions are signed only on your device.",
          "CoinGecko (through our servers): token price requests. No personal data is sent.",
          "Image hosts: NFT images load from the addresses the NFT's metadata provides, via Alchemy's image service.",
        ]}
      />
      <P>Each of these services has its own privacy policy. We send them only what the feature needs.</P>

      <H>Camera</H>
      <P>The camera is used only to scan wallet addresses and payment QR codes, while the scanner is open. Nothing is recorded or uploaded.</P>

      <H>How long we keep data</H>
      <P>
        Account data is kept while your account exists. When you delete your account, your profile, memberships, community messages, notifications,
        devices and reports you sent are erased right away. Communities you own pass to their most senior remaining member, or are deleted if no one else
        is in them. Data on blockchains and the XMTP network can't be deleted by anyone, including us.
      </P>

      <H>Your rights</H>
      <P>
        You can see and edit your profile in the app, and delete your account there. For a copy of the data we hold about you, or any other request, contact{" "}
        {EMAIL ?? "us"}. We'll answer within 30 days.
      </P>

      <H>Children</H>
      <P>HENSENG is not meant for children under 13 (or the minimum age in your country), and we don't knowingly collect their data.</P>

      <H>Changes</H>
      <P>If we change how data is handled, we'll update this page and the date above, and tell you in the app for significant changes.</P>
    </div>
  );
}
