/**
 * PREVIEW DATA — sample conversations and communities shown in builds where XMTP
 * messaging or the HENSENG API isn't configured. Every screen that uses
 * this file shows a "Preview" banner. None of these people or messages exist.
 */

import type { Presence } from "../ui/avatar";

export interface PreviewMessage {
  id: string;
  from: "me" | "them";
  text?: string;
  kind?: "text" | "voice" | "file" | "tx";
  meta?: string;
  time: string;
  status?: "sent" | "delivered" | "read";
  reactions?: string[];
  replyTo?: string;
}

export interface PreviewChat {
  id: string;
  name: string;
  group: boolean;
  presence?: Presence;
  last: string;
  time: string;
  unread: number;
  typing?: boolean;
  members?: number;
  messages: PreviewMessage[];
}

export const PREVIEW_CHATS: PreviewChat[] = [
  {
    id: "amara",
    name: "Amara Okafor",
    group: false,
    presence: "online",
    last: "Great! Let's do this 🚀",
    time: "9:32",
    unread: 3,
    typing: true,
    messages: [
      { id: "1", from: "them", text: "Did you see the new Base testnet faucet?", time: "9:20" },
      { id: "2", from: "me", text: "Yes — topped up this morning. Want to test a swap together?", time: "9:24", status: "read" },
      { id: "3", from: "them", text: "Great! Let's do this 🚀", time: "9:32", reactions: ["🔥", "👍"] },
      { id: "4", from: "me", kind: "tx", text: "Sent 0.05 ETH", meta: "Base Sepolia · Confirmed", time: "9:33", status: "delivered" },
      { id: "5", from: "them", kind: "voice", meta: "0:12", time: "9:35" },
      { id: "6", from: "me", kind: "file", text: "Project_Proposal.pdf", meta: "2.4 MB", time: "9:36", status: "sent", replyTo: "Great! Let's do this 🚀" },
    ],
  },
  {
    id: "builders",
    name: "Base Builders Lagos",
    group: true,
    members: 128,
    last: "Tolu: New proposal is live",
    time: "8:45",
    unread: 12,
    messages: [
      { id: "1", from: "them", text: "Tolu: New proposal is live — vote closes Friday.", time: "8:45" },
      { id: "2", from: "me", text: "Reading it now 👀", time: "8:47", status: "read" },
    ],
  },
  {
    id: "kenji",
    name: "Kenji Watanabe",
    group: false,
    presence: "away",
    last: "🎙 Voice message",
    time: "Yesterday",
    unread: 0,
    messages: [{ id: "1", from: "them", kind: "voice", meta: "0:41", time: "Yesterday" }],
  },
  {
    id: "defi-desk",
    name: "DeFi Desk",
    group: true,
    members: 42,
    last: "You: Check this out",
    time: "Yesterday",
    unread: 0,
    messages: [{ id: "1", from: "me", text: "Check this out", time: "Yesterday", status: "read" }],
  },
  {
    id: "sofia",
    name: "Sofia Mendes",
    group: false,
    presence: "online",
    last: "Nice collection!",
    time: "Tue",
    unread: 1,
    messages: [{ id: "1", from: "them", text: "Nice collection!", time: "Tue" }],
  },
  {
    id: "david",
    name: "David Mensah",
    group: false,
    last: "Bullish this week 📈",
    time: "Mon",
    unread: 0,
    messages: [{ id: "1", from: "them", text: "Bullish this week 📈", time: "Mon" }],
  },
];

export interface PreviewCommunity {
  id: string;
  name: string;
  tagline: string;
  description: string;
  members: number;
  category: "DeFi" | "NFTs" | "Builders" | "Gaming" | "DAO" | "Education";
  visibility: "public" | "private";
  joined: boolean;
  featured?: boolean;
  channels: { name: string; unread?: number; locked?: boolean }[];
  announcement?: string;
}

export const PREVIEW_COMMUNITIES: PreviewCommunity[] = [
  {
    id: "web3-innovators",
    name: "Web3 Innovators",
    tagline: "Founders and builders shipping on-chain",
    description: "A home for founders, engineers and designers building real products on Ethereum and its layer 2s. Weekly demo days and open office hours.",
    members: 245_000,
    category: "Builders",
    visibility: "public",
    joined: false,
    featured: true,
    channels: [{ name: "announcements" }, { name: "general", unread: 24 }, { name: "demo-day" }, { name: "hiring" }, { name: "core-team", locked: true }],
    announcement: "Demo day is this Thursday at 18:00 UTC. Sign up in #demo-day.",
  },
  { id: "defi-talk", name: "DeFi Talk", tagline: "Yield, risk and research", description: "Research-driven DeFi discussion with a strict no-shilling rule.", members: 128_000, category: "DeFi", visibility: "public", joined: true, channels: [{ name: "announcements" }, { name: "research" }, { name: "risk-alerts" }] },
  { id: "nft-galaxy", name: "NFT Galaxy", tagline: "Collectors and creators", description: "Discover artists, share drops and talk curation.", members: 92_000, category: "NFTs", visibility: "public", joined: false, channels: [{ name: "drops" }, { name: "showcase" }] },
  { id: "crypto-devs", name: "Crypto Devs", tagline: "Solidity, Rust and tooling", description: "Engineering help, code review and tooling tips.", members: 76_000, category: "Builders", visibility: "public", joined: true, channels: [{ name: "help" }, { name: "solidity" }, { name: "rust" }] },
  { id: "dao-circle", name: "DAO Circle", tagline: "Governance in practice", description: "Proposal writing, delegate programmes and treasury management.", members: 31_000, category: "DAO", visibility: "private", joined: false, channels: [{ name: "proposals", locked: true }] },
  { id: "chain-academy", name: "Chain Academy", tagline: "Learn Web3 from zero", description: "Beginner-friendly lessons, wallet safety and weekly Q&A.", members: 54_000, category: "Education", visibility: "public", joined: false, channels: [{ name: "lessons" }, { name: "questions" }] },
];
