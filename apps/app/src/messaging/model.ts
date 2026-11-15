/**
 * Platform-neutral chat model. The XMTP adapters (xmtp.ts for iOS/Android,
 * xmtp.web.ts for web and the extension) both map into these shapes, so the
 * Chats UI never touches an SDK directly.
 */

export type Consent = "allowed" | "unknown" | "denied";
export type ChatKind = "dm" | "group";

export interface ChatSummary {
  id: string;
  kind: ChatKind;
  /** Group name, or the peer's address for DMs (the UI swaps in a HENSENG profile name when known) */
  title: string;
  peerAddress?: string;
  memberCount?: number;
  consent: Consent;
  createdAt: Date;
  lastMessage?: { preview: string; sentAt: Date; fromMe: boolean };
}

export type MessageKind = "text" | "reply" | "reaction" | "readReceipt" | "groupUpdate" | "other";

export interface ChatMessage {
  id: string;
  chatId: string;
  senderInboxId: string;
  fromMe: boolean;
  sentAt: Date;
  kind: MessageKind;
  text?: string;
  replyToId?: string;
  reaction?: { emoji: string; action: "added" | "removed"; referenceId: string };
  status: "sending" | "sent" | "failed";
}

export interface MessagingClient {
  readonly inboxId: string;
  readonly address: string;
  sync(): Promise<void>;
  listChats(filter: "inbox" | "requests"): Promise<ChatSummary[]>;
  getChat(chatId: string): Promise<ChatSummary | null>;
  messages(chatId: string): Promise<ChatMessage[]>;
  sendText(chatId: string, text: string, replyToId?: string): Promise<void>;
  react(chatId: string, messageId: string, emoji: string, action: "added" | "removed"): Promise<void>;
  sendReadReceipt(chatId: string): Promise<void>;
  canMessage(address: string): Promise<boolean>;
  startDm(address: string): Promise<string>;
  createGroup(addresses: string[], name: string): Promise<string>;
  setConsent(chatId: string, consent: "allowed" | "denied"): Promise<void>;
  /** Streams every new message in every conversation. Returns a stop function. */
  streamAll(onMessage: (m: ChatMessage) => void): () => void;
  close(): void;
  /** Permanently deletes this device's local message database (used when the wallet is removed). */
  wipeLocal(): Promise<void>;
}

export interface ConnectOptions {
  env: "dev" | "production";
  address: `0x${string}`;
  /** EIP-191 personal_sign with the user's own key; returns a 0x-hex signature */
  signMessage: (message: string) => Promise<`0x${string}`>;
  /** 32-byte local database key (native). Ignored by the browser SDK. */
  dbEncryptionKey: Uint8Array;
}

/* ───────────── Pure helpers (unit-tested) ───────────── */

/** "xmtp.org/text:1.0" or { typeId: "text" } → "text" */
export function typeIdOf(contentType: string | { typeId: string } | undefined | null): string {
  if (!contentType) return "";
  if (typeof contentType !== "string") return contentType.typeId;
  const afterSlash = contentType.includes("/") ? contentType.split("/")[1]! : contentType;
  return afterSlash.split(":")[0]!;
}

export function kindOf(typeId: string): MessageKind {
  switch (typeId) {
    case "text":
    case "markdown":
      return "text";
    case "reply":
      return "reply";
    case "reaction":
      return "reaction";
    case "readReceipt":
      return "readReceipt";
    case "group_updated":
    case "groupUpdated":
      return "groupUpdate";
    default:
      return "other";
  }
}

/** Text shown in the chat list for a message. Non-content messages return null (they don't change the preview). */
export function previewOf(m: Pick<ChatMessage, "kind" | "text" | "reaction">): string | null {
  switch (m.kind) {
    case "text":
    case "reply":
      return m.text ?? "";
    case "reaction":
      return m.reaction?.action === "added" ? `Reacted ${m.reaction.emoji}` : null;
    case "other":
      return "Unsupported message";
    default:
      return null;
  }
}

/** Folds reaction messages onto their targets: messageId → emoji → set of sender inbox ids. */
export function collectReactions(messages: ChatMessage[]): Map<string, Map<string, Set<string>>> {
  const out = new Map<string, Map<string, Set<string>>>();
  for (const m of [...messages].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())) {
    if (m.kind !== "reaction" || !m.reaction) continue;
    const byEmoji = out.get(m.reaction.referenceId) ?? new Map<string, Set<string>>();
    const who = byEmoji.get(m.reaction.emoji) ?? new Set<string>();
    if (m.reaction.action === "added") who.add(m.senderInboxId);
    else who.delete(m.senderInboxId);
    if (who.size) byEmoji.set(m.reaction.emoji, who);
    else byEmoji.delete(m.reaction.emoji);
    out.set(m.reaction.referenceId, byEmoji);
  }
  return out;
}

/** Latest time the other side sent a read receipt (DMs). My messages sent before it are "read". */
export function lastPeerReadAt(messages: ChatMessage[]): Date | null {
  let latest: Date | null = null;
  for (const m of messages) if (m.kind === "readReceipt" && !m.fromMe && (!latest || m.sentAt > latest)) latest = m.sentAt;
  return latest;
}

export type Target =
  | { type: "address"; value: `0x${string}` }
  | { type: "ens"; value: string }
  | { type: "username"; value: string }
  | { type: "invalid"; reason: string };

/** Parses what a user typed into "New chat": 0x address, ENS name or @username. */
export function parseTarget(input: string): Target {
  const t = input.trim();
  if (!t) return { type: "invalid", reason: "Enter an address, ENS name or @username." };
  if (/^0x[0-9a-fA-F]{40}$/.test(t)) return { type: "address", value: t.toLowerCase() as `0x${string}` };
  if (/^0x/i.test(t)) return { type: "invalid", reason: "That address is not 42 characters long. Check it and try again." };
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i.test(t)) return { type: "ens", value: t.toLowerCase() };
  const u = t.replace(/^@/, "").toLowerCase();
  if (/^[a-z0-9_]{3,20}$/.test(u)) return { type: "username", value: u };
  return { type: "invalid", reason: "Enter an address (0x…), an ENS name (name.eth) or a HENSENG @username." };
}

export function nsToDate(ns: bigint | number | undefined): Date {
  if (ns === undefined) return new Date(0);
  return new Date(Number(BigInt(ns) / 1_000_000n));
}

export function shortAddr(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
