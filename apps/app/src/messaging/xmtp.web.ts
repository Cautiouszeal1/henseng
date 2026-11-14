/**
 * XMTP adapter for the web app and Chrome extension (@xmtp/browser-sdk).
 * Runs XMTP's WebAssembly core in a Web Worker; local message history is kept
 * in the browser's private file system (OPFS) for this site only.
 */
import {
  Client,
  ConsentState,
  IdentifierKind,
  ReactionAction,
  ReactionSchema,
  type DecodedMessage,
  type Dm,
  type Group,
  type Identifier,
  type Signer,
} from "@xmtp/browser-sdk";
import { hexToBytes } from "viem";
import { kindOf, nsToDate, previewOf, typeIdOf, type ChatMessage, type ChatSummary, type ConnectOptions, type Consent, type MessagingClient } from "./model";

type AnyClient = Client<unknown>;
type AnyConv = Dm<unknown> | Group<unknown>;
type AnyMsg = DecodedMessage<unknown>;

const consentOut = (s: ConsentState): Consent => (s === ConsentState.Allowed ? "allowed" : s === ConsentState.Denied ? "denied" : "unknown");
const eth = (address: string): Identifier => ({ identifier: address.toLowerCase(), identifierKind: IdentifierKind.Ethereum });

function mapMessage(m: AnyMsg, myInboxId: string): ChatMessage {
  const typeId = typeIdOf(m.contentType);
  const kind = kindOf(typeId);
  const base: ChatMessage = {
    id: m.id,
    chatId: m.conversationId,
    senderInboxId: m.senderInboxId,
    fromMe: m.senderInboxId === myInboxId,
    sentAt: nsToDate(m.sentAtNs),
    kind,
    status: Number(m.deliveryStatus) === 2 ? "failed" : Number(m.deliveryStatus) === 0 ? "sending" : "sent",
  };
  const c = m.content as unknown;
  if (kind === "text") return { ...base, text: typeof c === "string" ? c : m.fallback };
  if (kind === "reply") {
    const r = c as { content?: unknown; referenceId?: string; reference?: string } | undefined;
    return { ...base, text: typeof r?.content === "string" ? r.content : m.fallback ?? "", replyToId: r?.referenceId ?? r?.reference };
  }
  if (kind === "reaction") {
    const r = c as { content: string; action: ReactionAction; reference: string } | undefined;
    if (r) return { ...base, reaction: { emoji: r.content, action: r.action === ReactionAction.Removed ? "removed" : "added", referenceId: r.reference } };
  }
  return { ...base, text: m.fallback };
}

class WebXmtp implements MessagingClient {
  private stops: (() => void)[] = [];
  private addressCache = new Map<string, string>();

  constructor(
    private client: AnyClient,
    readonly address: string,
  ) {}

  get inboxId() {
    return this.client.inboxId ?? "";
  }

  async sync() {
    await this.client.conversations.syncAll([ConsentState.Allowed, ConsentState.Unknown]);
  }

  private async peerAddress(inboxId: string): Promise<string | undefined> {
    if (this.addressCache.has(inboxId)) return this.addressCache.get(inboxId);
    const [state] = await this.client.preferences.getInboxStates([inboxId]);
    const addr = state?.accountIdentifiers.find((i) => i.identifierKind === IdentifierKind.Ethereum)?.identifier.toLowerCase();
    if (addr) this.addressCache.set(inboxId, addr);
    return addr;
  }

  private async summary(c: AnyConv): Promise<ChatSummary> {
    const [consent, lastRaw] = await Promise.all([c.consentState(), c.lastMessage()]);
    const last = lastRaw ? mapMessage(lastRaw, this.inboxId) : undefined;
    const preview = last ? previewOf(last) : null;
    const lastMessage = last && preview !== null ? { preview, sentAt: last.sentAt, fromMe: last.fromMe } : undefined;
    const createdAt = c.createdAt ?? new Date(0);
    if ("peerInboxId" in c) {
      const peer = await c.peerInboxId();
      const peerAddress = await this.peerAddress(peer);
      return { id: c.id, kind: "dm", title: peerAddress ?? peer, peerAddress, consent: consentOut(consent), createdAt, lastMessage };
    }
    const members = await c.members();
    return { id: c.id, kind: "group", title: c.name || "Group chat", memberCount: members.length, consent: consentOut(consent), createdAt, lastMessage };
  }

  async listChats(filter: "inbox" | "requests") {
    const list = (await this.client.conversations.list({ consentStates: [filter === "inbox" ? ConsentState.Allowed : ConsentState.Unknown] })) as AnyConv[];
    const out = await Promise.all(list.map((c) => this.summary(c)));
    return out.sort((a, b) => (b.lastMessage?.sentAt ?? b.createdAt).getTime() - (a.lastMessage?.sentAt ?? a.createdAt).getTime());
  }

  private async conv(chatId: string): Promise<AnyConv> {
    const c = (await this.client.conversations.getConversationById(chatId)) as AnyConv | undefined;
    if (!c) throw new Error("This conversation isn't available in this browser yet. Refresh to sync.");
    return c;
  }

  async getChat(chatId: string) {
    const c = (await this.client.conversations.getConversationById(chatId)) as AnyConv | undefined;
    return c ? this.summary(c) : null;
  }

  async messages(chatId: string) {
    const c = await this.conv(chatId);
    await c.sync();
    const msgs = await c.messages({ limit: 200n });
    return msgs.map((m) => mapMessage(m, this.inboxId)).sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  }

  async sendText(chatId: string, text: string, replyToId?: string) {
    const c = await this.conv(chatId);
    if (!replyToId) {
      await c.sendText(text);
      return;
    }
    const target = await this.client.conversations.getMessageById(replyToId);
    await c.sendReply({
      reference: replyToId,
      referenceInboxId: target?.senderInboxId,
      content: { type: { authorityId: "xmtp.org", typeId: "text", versionMajor: 1, versionMinor: 0 }, parameters: { encoding: "UTF-8" }, content: new TextEncoder().encode(text) },
    } as never);
  }

  async react(chatId: string, messageId: string, emoji: string, action: "added" | "removed") {
    const c = await this.conv(chatId);
    const target = await this.client.conversations.getMessageById(messageId);
    await c.sendReaction({
      reference: messageId,
      referenceInboxId: target?.senderInboxId ?? "",
      action: action === "added" ? ReactionAction.Added : ReactionAction.Removed,
      schema: ReactionSchema.Unicode,
      content: emoji,
    });
  }

  async sendReadReceipt(chatId: string) {
    const c = await this.conv(chatId);
    await c.sendReadReceipt().catch(() => undefined);
  }

  async canMessage(address: string) {
    const r = await this.client.canMessage([eth(address)]);
    for (const [k, v] of r) if (k.toLowerCase() === address.toLowerCase()) return v;
    return false;
  }

  async startDm(address: string) {
    const dm = await this.client.conversations.createDmWithIdentifier(eth(address));
    await dm.updateConsentState(ConsentState.Allowed);
    return dm.id;
  }

  async createGroup(addresses: string[], name: string) {
    const g = await this.client.conversations.createGroupWithIdentifiers(addresses.map(eth), { groupName: name });
    return g.id;
  }

  async setConsent(chatId: string, consent: "allowed" | "denied") {
    const c = await this.conv(chatId);
    await c.updateConsentState(consent === "allowed" ? ConsentState.Allowed : ConsentState.Denied);
  }

  streamAll(onMessage: (m: ChatMessage) => void) {
    const holder: { stream: { end?: () => unknown } | null } = { stream: null };
    let stopped = false;
    void (async () => {
      const s = await this.client.conversations.streamAllMessages();
      holder.stream = s as unknown as { end?: () => unknown };
      if (stopped) return void holder.stream.end?.();
      for await (const m of s) {
        if (stopped) break;
        if (m) onMessage(mapMessage(m, this.inboxId));
      }
    })().catch(() => undefined);
    const stop = () => {
      stopped = true;
      void holder.stream?.end?.();
    };
    this.stops.push(stop);
    return stop;
  }

  close() {
    this.stops.forEach((s) => s());
    this.client.close();
  }
}

export async function connectXmtp(opts: ConnectOptions): Promise<MessagingClient> {
  const signer: Signer = {
    type: "EOA",
    getIdentifier: () => eth(opts.address),
    signMessage: async (message: string) => hexToBytes(await opts.signMessage(message)),
  };
  // ClientOptions is a union (network options | custom backend); Omit<> in the SDK's signature hides `env`.
  const options = { env: opts.env, appVersion: "henseng-web/1" } as unknown as Parameters<typeof Client.create>[1];
  const client = await Client.create(signer, options);
  return new WebXmtp(client as unknown as AnyClient, opts.address.toLowerCase());
}

export const messagingPlatform = "web" as const;
