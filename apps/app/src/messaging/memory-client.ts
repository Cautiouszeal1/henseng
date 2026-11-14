/**
 * TEST MODE ONLY — an in-memory stand-in for XMTP, enabled with EXPO_PUBLIC_XMTP_ENV=memory.
 *
 * Nothing here is encrypted or leaves the device. It exists so the live Chats UI can be
 * exercised (automated tests, screenshots, demos) where the XMTP network is unreachable.
 * The app shows a "Test mode" banner whenever this client is active. Never ship a build with it.
 */
import type { ChatMessage, ChatSummary, MessagingClient } from "./model";

const PEER_A = "0x1111111111111111111111111111111111111111";
const PEER_B = "0x2222222222222222222222222222222222222222";
const STRANGER = "0x3333333333333333333333333333333333333333";
/** Addresses ending in 0000 are treated as "not on XMTP", to exercise that error path. */
const unreachable = (a: string) => a.toLowerCase().endsWith("0000");

interface Chat extends Omit<ChatSummary, "lastMessage"> {
  members: string[];
}

export function createMemoryClient(address: string): MessagingClient {
  const me = address.toLowerCase();
  const inboxOf = (a: string) => `inbox-${a.toLowerCase().slice(2, 10)}`;
  const myInbox = inboxOf(me);
  let seq = 0;
  const t0 = Date.now();
  const chats: Chat[] = [];
  const msgs: ChatMessage[] = [];
  const listeners = new Set<(m: ChatMessage) => void>();

  const add = (m: Omit<ChatMessage, "id" | "status" | "fromMe">) => {
    const full: ChatMessage = { ...m, id: `m${++seq}`, status: "sent", fromMe: m.senderInboxId === myInbox };
    msgs.push(full);
    listeners.forEach((fn) => fn(full));
    return full;
  };
  const newChat = (c: Omit<Chat, "id" | "createdAt">) => {
    const chat: Chat = { ...c, id: `chat-${chats.length + 1}`, createdAt: new Date() };
    chats.push(chat);
    return chat;
  };

  // Seed: one accepted DM, one group, one message request.
  const dm = newChat({ kind: "dm", title: PEER_A, peerAddress: PEER_A, consent: "allowed", members: [me, PEER_A] });
  add({ chatId: dm.id, senderInboxId: inboxOf(PEER_A), sentAt: new Date(t0 - 3_600_000), kind: "text", text: "Hey! Test mode chat — nothing here is real." });
  add({ chatId: dm.id, senderInboxId: myInbox, sentAt: new Date(t0 - 3_500_000), kind: "text", text: "Got it 👍" });
  const grp = newChat({ kind: "group", title: "Test group", consent: "allowed", members: [me, PEER_A, PEER_B], memberCount: 3 });
  add({ chatId: grp.id, senderInboxId: inboxOf(PEER_B), sentAt: new Date(t0 - 600_000), kind: "text", text: "Welcome to the simulated group." });
  const req = newChat({ kind: "dm", title: STRANGER, peerAddress: STRANGER, consent: "unknown", members: [me, STRANGER] });
  add({ chatId: req.id, senderInboxId: inboxOf(STRANGER), sentAt: new Date(t0 - 120_000), kind: "text", text: "Hi, can we talk? (simulated request)" });

  const summary = (c: Chat): ChatSummary => {
    const last = [...msgs].reverse().find((m) => m.chatId === c.id && (m.kind === "text" || m.kind === "reply"));
    const { members: _m, ...rest } = c;
    return { ...rest, lastMessage: last ? { preview: last.text ?? "", sentAt: last.sentAt, fromMe: last.fromMe } : undefined };
  };
  const find = (id: string) => {
    const c = chats.find((x) => x.id === id);
    if (!c) throw new Error("Chat not found");
    return c;
  };
  const sortKey = (c: ChatSummary) => (c.lastMessage?.sentAt ?? c.createdAt).getTime();

  return {
    inboxId: myInbox,
    address: me,
    async sync() {},
    async listChats(filter) {
      return chats
        .filter((c) => (filter === "inbox" ? c.consent === "allowed" : c.consent === "unknown"))
        .map(summary)
        .sort((a, b) => sortKey(b) - sortKey(a));
    },
    async getChat(id) {
      const c = chats.find((x) => x.id === id);
      return c ? summary(c) : null;
    },
    async messages(id) {
      return msgs.filter((m) => m.chatId === id);
    },
    async sendText(id, text, replyToId) {
      const c = find(id);
      c.consent = "allowed";
      add({ chatId: id, senderInboxId: myInbox, sentAt: new Date(), kind: replyToId ? "reply" : "text", text, replyToId });
      // Simulated peer: reads the message, then replies.
      const peer = c.peerAddress ?? c.members.find((m) => m !== me);
      if (!peer) return;
      setTimeout(() => add({ chatId: id, senderInboxId: inboxOf(peer), sentAt: new Date(), kind: "readReceipt" }), 400);
      setTimeout(() => add({ chatId: id, senderInboxId: inboxOf(peer), sentAt: new Date(), kind: "text", text: `Simulated reply to "${text.slice(0, 40)}"` }), 900);
    },
    async react(id, messageId, emoji, action) {
      add({ chatId: id, senderInboxId: myInbox, sentAt: new Date(), kind: "reaction", reaction: { emoji, action, referenceId: messageId } });
    },
    async sendReadReceipt() {},
    async canMessage(a) {
      return !unreachable(a);
    },
    async startDm(a) {
      const addr = a.toLowerCase();
      const existing = chats.find((c) => c.kind === "dm" && c.peerAddress === addr);
      if (existing) return existing.id;
      return newChat({ kind: "dm", title: addr, peerAddress: addr, consent: "allowed", members: [me, addr] }).id;
    },
    async createGroup(addresses, name) {
      const members = [me, ...addresses.map((a) => a.toLowerCase())];
      const g = newChat({ kind: "group", title: name, consent: "allowed", members, memberCount: members.length });
      add({ chatId: g.id, senderInboxId: myInbox, sentAt: new Date(), kind: "groupUpdate" });
      return g.id;
    },
    async setConsent(id, consent) {
      find(id).consent = consent;
    },
    streamAll(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close() {
      listeners.clear();
    },
  };
}
