/**
 * XMTP adapter for iOS and Android (@xmtp/react-native-sdk, MLS end-to-end
 * encryption). Requires a development or store build — not Expo Go.
 */
import { Client, PublicIdentity, type Conversation, type DecodedMessage, type Signer } from "@xmtp/react-native-sdk";
import { kindOf, nsToDate, previewOf, typeIdOf, type ChatMessage, type ChatSummary, type ConnectOptions, type Consent, type MessagingClient } from "./model";

type AnyMessage = DecodedMessage<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type AnyConversation = Conversation<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type AnyClient = Client<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function mapMessage(m: AnyMessage, chatId: string, myInboxId: string): ChatMessage {
  const typeId = typeIdOf(m.contentTypeId);
  const kind = kindOf(typeId);
  const native = m.nativeContent ?? {};
  const base: ChatMessage = {
    id: m.id,
    chatId,
    senderInboxId: m.senderInboxId,
    fromMe: m.senderInboxId === myInboxId,
    sentAt: nsToDate(m.sentNs),
    kind,
    status: String(m.deliveryStatus) === "FAILED" ? "failed" : String(m.deliveryStatus) === "UNPUBLISHED" ? "sending" : "sent",
  };
  if (kind === "text") return { ...base, text: native.text ?? (typeof m.content() === "string" ? (m.content() as string) : m.fallback) };
  if (kind === "reply" && native.reply) return { ...base, text: native.reply.content?.text ?? m.fallback ?? "", replyToId: native.reply.reference };
  const reaction = native.reaction ?? native.reactionV2;
  if (kind === "reaction" && reaction) {
    return { ...base, reaction: { emoji: reaction.content, action: reaction.action === "removed" ? "removed" : "added", referenceId: reaction.reference } };
  }
  return { ...base, text: m.fallback };
}

class NativeXmtp implements MessagingClient {
  private stopStream: (() => void) | null = null;
  private addressCache = new Map<string, string>();

  constructor(private client: AnyClient) {}

  get inboxId() {
    return this.client.inboxId;
  }
  get address() {
    return this.client.publicIdentity.identifier.toLowerCase();
  }

  async sync() {
    await this.client.conversations.syncAllConversations();
  }

  private async peerAddress(inboxId: string): Promise<string | undefined> {
    if (this.addressCache.has(inboxId)) return this.addressCache.get(inboxId);
    const [state] = await this.client.inboxStates(false, [inboxId]);
    const addr = state?.identities.find((i) => i.kind === "ETHEREUM")?.identifier.toLowerCase();
    if (addr) this.addressCache.set(inboxId, addr);
    return addr;
  }

  private async summary(c: AnyConversation): Promise<ChatSummary> {
    const consent = (await c.consentState()) as Consent;
    const last = c.lastMessage ? mapMessage(c.lastMessage, c.id, this.inboxId) : undefined;
    const preview = last ? previewOf(last) : null;
    const lastMessage = last && preview !== null ? { preview, sentAt: last.sentAt, fromMe: last.fromMe } : undefined;
    if (c.version === "DM") {
      const peer = await (c as { peerInboxId(): Promise<string> }).peerInboxId();
      const peerAddress = await this.peerAddress(peer);
      return { id: c.id, kind: "dm", title: peerAddress ?? peer, peerAddress, consent, createdAt: new Date(c.createdAt), lastMessage };
    }
    const g = c as AnyConversation & { name(): Promise<string>; members(): Promise<unknown[]> };
    const [name, members] = await Promise.all([g.name(), g.members()]);
    return { id: c.id, kind: "group", title: name || "Group chat", memberCount: members.length, consent, createdAt: new Date(c.createdAt), lastMessage };
  }

  async listChats(filter: "inbox" | "requests") {
    const list = await this.client.conversations.list({ lastMessage: true }, undefined, filter === "inbox" ? ["allowed"] : ["unknown"]);
    const out = await Promise.all(list.map((c) => this.summary(c)));
    return out.sort((a, b) => (b.lastMessage?.sentAt ?? b.createdAt).getTime() - (a.lastMessage?.sentAt ?? a.createdAt).getTime());
  }

  private async conv(chatId: string) {
    const c = await this.client.conversations.findConversation(chatId as never);
    if (!c) throw new Error("This conversation isn't available on this device yet. Pull to refresh.");
    return c;
  }

  async getChat(chatId: string) {
    const c = await this.client.conversations.findConversation(chatId as never);
    return c ? this.summary(c) : null;
  }

  async messages(chatId: string) {
    const c = await this.conv(chatId);
    await c.sync();
    const msgs = await c.messages({ limit: 200, direction: "ASCENDING" });
    return msgs.map((m) => mapMessage(m, chatId, this.inboxId));
  }

  async sendText(chatId: string, text: string, replyToId?: string) {
    const c = await this.conv(chatId);
    if (replyToId) await c.send({ reply: { reference: replyToId, content: { text } } } as never);
    else await c.send(text);
  }

  async react(chatId: string, messageId: string, emoji: string, action: "added" | "removed") {
    const c = await this.conv(chatId);
    await c.send({ reaction: { reference: messageId, action, schema: "unicode", content: emoji } } as never);
  }

  async sendReadReceipt(chatId: string) {
    const c = await this.conv(chatId);
    await c.send({ readReceipt: {} } as never).catch(() => undefined);
  }

  async canMessage(address: string) {
    const r = await Client.canMessage(this.client.environment, [new PublicIdentity(address.toLowerCase(), "ETHEREUM")]);
    return Object.entries(r).some(([k, v]) => k.toLowerCase() === address.toLowerCase() && v);
  }

  async startDm(address: string) {
    const dm = await this.client.conversations.findOrCreateDmWithIdentity(new PublicIdentity(address.toLowerCase(), "ETHEREUM"));
    await dm.updateConsent("allowed");
    return dm.id;
  }

  async createGroup(addresses: string[], name: string) {
    const g = await this.client.conversations.newGroupWithIdentities(
      addresses.map((a) => new PublicIdentity(a.toLowerCase(), "ETHEREUM")),
      { name, permissionLevel: "admin_only" },
    );
    return g.id;
  }

  async setConsent(chatId: string, consent: "allowed" | "denied") {
    const c = await this.conv(chatId);
    await c.updateConsent(consent);
  }

  streamAll(onMessage: (m: ChatMessage) => void) {
    let active = true;
    void this.client.conversations.streamAllMessages(async (m) => {
      if (!active) return;
      const topic = String(m.topic);
      const chatId = topic.split("/").at(-2)?.replace(/^g-/, "") ?? topic;
      onMessage(mapMessage(m, chatId, this.inboxId));
    });
    this.stopStream = () => {
      active = false;
      this.client.conversations.cancelStreamAllMessages();
    };
    return this.stopStream;
  }

  close() {
    this.stopStream?.();
  }

  async wipeLocal() {
    this.close();
    await this.client.deleteLocalDatabase();
  }
}

/** Native: the database is encrypted with a per-wallet key; deleting the key (key-storage) makes any leftover file unreadable. */
export async function clearLocalMessagingStorage(): Promise<void> {}

export async function connectXmtp(opts: ConnectOptions): Promise<MessagingClient> {
  const signer: Signer = {
    getIdentifier: async () => new PublicIdentity(opts.address.toLowerCase(), "ETHEREUM"),
    getChainId: () => undefined,
    getBlockNumber: () => undefined,
    signerType: () => "EOA",
    signMessage: async (message: string) => ({ signature: await opts.signMessage(message) }),
  };
  const client = await Client.create(signer, { env: opts.env, dbEncryptionKey: opts.dbEncryptionKey });
  return new NativeXmtp(client);
}

export const messagingPlatform = "native" as const;
