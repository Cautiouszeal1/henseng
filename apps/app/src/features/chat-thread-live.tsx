import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Ban, Check, CheckCheck, CornerUpLeft, Flag, Lock, Send, ShieldCheck, Users, AlertCircle, SmilePlus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "../api/api-context";
import { MESSAGING_TEST_MODE, useMessaging } from "../messaging/messaging-context";
import { collectReactions, lastPeerReadAt, shortAddr, type ChatMessage, type ChatSummary } from "../messaging/model";
import { useProfile } from "../profile/profile-context";
import { ScreenGlow } from "../ui/art";
import { Avatar } from "../ui/avatar";
import { Sheet, useToast } from "../ui/overlays";
import { Button, EmptyState, ErrorState, IconButton, noOutline, Skeleton, Tap, Text } from "../ui/primitives";
import { useLayout, useTheme } from "../ui/theme";
import { buttonGradient, fonts, radius } from "../ui/tokens";

const REACTIONS = ["❤️", "👍", "🔥", "😂", "🙏"];

export function useChatTitle(chat: Pick<ChatSummary, "kind" | "title" | "peerAddress"> | null) {
  const { profileFor } = useMessaging();
  if (!chat) return "";
  if (chat.kind === "group") return chat.title;
  const p = profileFor(chat.peerAddress);
  return p?.displayName || (p?.username ? `@${p.username}` : chat.peerAddress ? shortAddr(chat.peerAddress) : chat.title);
}

function time(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** End-to-end encrypted conversation (XMTP). */
export function ChatThreadLive({ chatId, embedded = false }: { chatId: string; embedded?: boolean }) {
  const { theme } = useTheme();
  const { isWide } = useLayout();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { client, subscribe, markRead } = useMessaging();
  const { profile } = useProfile();
  const api = useApi();
  const [chat, setChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [safety, setSafety] = useState(false);
  const list = useRef<FlatList<ChatMessage>>(null);
  const title = useChatTitle(chat);

  const load = useCallback(async () => {
    if (!client) return;
    try {
      const [c, msgs] = await Promise.all([client.getChat(chatId), client.messages(chatId)]);
      setChat(c);
      setMessages(msgs);
      setError(null);
      markRead(chatId);
      if (c?.kind === "dm" && c.consent === "allowed" && profile.readReceipts && msgs.some((m) => !m.fromMe && m.kind !== "readReceipt")) {
        void client.sendReadReceipt(chatId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open this conversation.");
    }
  }, [client, chatId, markRead, profile.readReceipts]);

  useEffect(() => {
    setMessages(null);
    void load();
  }, [load]);

  // Live: append messages for this chat as they stream in.
  useEffect(
    () =>
      subscribe((m) => {
        if (m.chatId !== chatId) return;
        setMessages((prev) => (prev && !prev.some((x) => x.id === m.id) ? [...prev, m] : prev));
        if (!m.fromMe) {
          markRead(chatId);
          if (m.kind !== "readReceipt" && chat?.kind === "dm" && profile.readReceipts) void client?.sendReadReceipt(chatId);
        }
      }),
    [subscribe, chatId, markRead, chat?.kind, profile.readReceipts, client],
  );

  const visible = useMemo(() => (messages ?? []).filter((m) => m.kind === "text" || m.kind === "reply" || m.kind === "other"), [messages]);
  const reactions = useMemo(() => collectReactions(messages ?? []), [messages]);
  const peerReadAt = useMemo(() => (chat?.kind === "dm" ? lastPeerReadAt(messages ?? []) : null), [messages, chat?.kind]);
  const byId = useMemo(() => new Map((messages ?? []).map((m) => [m.id, m])), [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !client) return;
    const temp: ChatMessage = { id: `local-${Date.now()}`, chatId, senderInboxId: client.inboxId, fromMe: true, sentAt: new Date(), kind: replyTo ? "reply" : "text", text, replyToId: replyTo?.id, status: "sending" };
    setMessages((prev) => [...(prev ?? []), temp]);
    setDraft("");
    const reply = replyTo;
    setReplyTo(null);
    try {
      await client.sendText(chatId, text, reply?.id);
      // The stream delivers the published copy; drop the optimistic one.
      setMessages((prev) => prev?.map((m) => (m.id === temp.id ? { ...m, status: "sent" } : m)) ?? null);
      setTimeout(() => void load(), 600);
    } catch {
      setMessages((prev) => prev?.map((m) => (m.id === temp.id ? { ...m, status: "failed" } : m)) ?? null);
      toast("Message not sent. Check your connection and try again.", "error");
    }
  };

  const react = async (m: ChatMessage, emoji: string) => {
    if (!client) return;
    setMenuFor(null);
    const mine = reactions.get(m.id)?.get(emoji)?.has(client.inboxId);
    try {
      await client.react(chatId, m.id, emoji, mine ? "removed" : "added");
      await load();
    } catch {
      toast("Couldn't send that reaction.", "error");
    }
  };

  const setConsent = async (c: "allowed" | "denied") => {
    if (!client) return;
    await client.setConsent(chatId, c);
    toast(c === "allowed" ? "Request accepted" : "Blocked. You won't get messages from this chat.", "success");
    if (c === "denied") router.canGoBack() ? router.back() : router.replace("/chats");
    else await load();
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace("/chats"));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: embedded && theme.mode === "dark" ? "transparent" : theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {!embedded && theme.mode === "dark" ? <ScreenGlow intensity={0.7} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: embedded || isWide ? 16 : insets.top + 6, paddingBottom: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        {!embedded && <IconButton icon={ArrowLeft} label="Back" tone="plain" onPress={back} />}
        <Avatar name={title || "Chat"} seed={chat?.peerAddress ?? chatId} size={44} square={chat?.kind === "group"} />
        <View style={{ flex: 1 }}>
          <Text variant="subheading" numberOfLines={1}>{title || "Loading…"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Lock size={11} color={MESSAGING_TEST_MODE ? theme.warning : theme.positive} />
            <Text variant="caption" style={{ color: MESSAGING_TEST_MODE ? theme.warning : theme.positive }}>
              {MESSAGING_TEST_MODE ? "Test mode · not encrypted" : "End-to-end encrypted"}{chat?.kind === "group" && chat.memberCount ? ` · ${chat.memberCount} members` : ""}
            </Text>
          </View>
        </View>
        <IconButton icon={ShieldCheck} label="Safety options" tone="plain" onPress={() => setSafety(true)} />
      </View>

      {chat?.consent === "unknown" ? (
        <View style={{ margin: 12, padding: 14, gap: 10, borderRadius: radius.lg, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
          <Text variant="bodyStrong">Message request</Text>
          <Text variant="caption" tone="secondary">
            {title} isn't in your chats yet. They won't know you've seen this until you reply. Only accept if you know them. HENSENG will never message you asking for your recovery phrase.
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label="Accept" size="md" style={{ flex: 1 }} onPress={() => void setConsent("allowed")} />
            <Button label="Block" size="md" kind="danger" style={{ flex: 1 }} onPress={() => void setConsent("denied")} />
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={{ padding: 16 }}><ErrorState title="Couldn't open this chat" body={error} onRetry={() => void load()} /></View>
      ) : messages === null ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton width="60%" height={44} radius={18} />
          <Skeleton width="45%" height={44} radius={18} style={{ alignSelf: "flex-end" }} />
          <Skeleton width="70%" height={44} radius={18} />
        </View>
      ) : (
        <FlatList
          ref={list}
          data={visible}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingVertical: 12, flexGrow: 1 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <EmptyState icon={Lock} title="Say hello" body="Messages here are end-to-end encrypted with XMTP. Only the people in this chat can read them, not HENSENG." />
          }
          renderItem={({ item: m }) => {
            const mine = m.fromMe;
            const reply = m.replyToId ? byId.get(m.replyToId) : undefined;
            const r = reactions.get(m.id);
            const read = mine && peerReadAt && m.sentAt <= peerReadAt;
            const fg = mine ? "#FFFFFF" : theme.text;
            const sub = mine ? "rgba(255,255,255,0.75)" : theme.textTertiary;
            const body = (
              <View style={{ gap: 6 }}>
                {m.kind === "reply" ? (
                  <View style={{ borderLeftWidth: 3, borderLeftColor: mine ? "rgba(255,255,255,0.7)" : theme.accent, paddingLeft: 8 }}>
                    <Text variant="caption" style={{ color: sub }} numberOfLines={1}>{reply?.text ?? "Earlier message"}</Text>
                  </View>
                ) : null}
                {m.kind === "other" ? (
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <AlertCircle size={14} color={sub} />
                    <Text variant="caption" style={{ color: sub, fontStyle: "italic" }}>{m.text || "This message type isn't supported yet."}</Text>
                  </View>
                ) : (
                  <Text style={{ color: fg }} selectable>{m.text}</Text>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" }}>
                  <Text variant="label" style={{ color: sub, fontSize: 11 }}>{m.status === "sending" ? "Sending…" : m.status === "failed" ? "Not sent" : time(m.sentAt)}</Text>
                  {mine && m.status === "sent" ? read ? <CheckCheck size={14} color="#9FD0FF" accessibilityLabel="Read" /> : <Check size={14} color={sub} accessibilityLabel="Sent" /> : null}
                </View>
              </View>
            );
            const shape = { maxWidth: "100%" as const, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderBottomRightRadius: mine ? 6 : 20, borderBottomLeftRadius: mine ? 20 : 6 };
            return (
              <Animated.View entering={FadeInUp.duration(200)} style={{ alignItems: mine ? "flex-end" : "flex-start", marginVertical: 4, paddingHorizontal: 16 }}>
                <View style={{ flexDirection: mine ? "row-reverse" : "row", alignItems: "center", gap: 6, maxWidth: "86%" }}>
                  <Tap onLongPress={() => setMenuFor((v) => (v === m.id ? null : m.id))} onPress={() => menuFor && setMenuFor(null)} accessibilityHint="Long press to react or reply" style={{ flexShrink: 1 }}>
                    {mine ? (
                      <LinearGradient colors={buttonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={shape}>{body}</LinearGradient>
                    ) : (
                      <LinearGradient colors={theme.mode === "dark" ? ["#272639", "#1E1D2B"] : ["#F4F2FA", "#ECEAF4"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[shape, { borderWidth: 1, borderColor: theme.border, borderTopColor: theme.mode === "dark" ? "rgba(255,255,255,0.12)" : theme.border }]}>{body}</LinearGradient>
                    )}
                  </Tap>
                  {Platform.OS === "web" && m.status === "sent" ? (
                    // Mouse and keyboard users get a visible button instead of long-press.
                    <Tap onPress={() => setMenuFor((v) => (v === m.id ? null : m.id))} accessibilityRole="button" accessibilityLabel="Message actions" haptic={false} style={{ padding: 6, borderRadius: radius.full, opacity: menuFor === m.id ? 1 : 0.55 }}>
                      <SmilePlus size={16} color={theme.textTertiary} />
                    </Tap>
                  ) : null}
                </View>
                {r && r.size ? (
                  <View style={{ flexDirection: "row", gap: 6, marginTop: -6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                    {[...r.entries()].map(([emoji, who]) => (
                      <Text key={emoji} variant="caption">{emoji}{who.size > 1 ? ` ${who.size}` : ""}</Text>
                    ))}
                  </View>
                ) : null}
                {menuFor === m.id ? (
                  <View style={{ flexDirection: "row", gap: 4, marginTop: 6, padding: 6, borderRadius: radius.full, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong }}>
                    {REACTIONS.map((e) => (
                      <Tap key={e} onPress={() => void react(m, e)} accessibilityLabel={`React ${e}`} style={{ padding: 4 }}>
                        <Text style={{ fontSize: 20 }}>{e}</Text>
                      </Tap>
                    ))}
                    <Tap onPress={() => { setReplyTo(m); setMenuFor(null); }} accessibilityLabel="Reply" style={{ padding: 6 }}>
                      <CornerUpLeft size={18} color={theme.text} />
                    </Tap>
                  </View>
                ) : null}
              </Animated.View>
            );
          }}
        />
      )}

      {replyTo ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 12, padding: 10, borderRadius: radius.md, backgroundColor: theme.surface, borderLeftWidth: 3, borderLeftColor: theme.accent }}>
          <CornerUpLeft size={16} color={theme.accent} />
          <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>Replying to: {replyTo.text}</Text>
          <Tap onPress={() => setReplyTo(null)} accessibilityLabel="Cancel reply"><Text variant="caption" tone="accent">Cancel</Text></Tap>
        </View>
      ) : null}

      {chat?.consent !== "denied" ? (
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: embedded || isWide ? 16 : insets.bottom + 10 }}>
          <View style={{ flex: 1, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message…"
              placeholderTextColor={theme.textTertiary}
              multiline
              accessibilityLabel="Message"
              onSubmitEditing={() => void send()}
              style={[{ color: theme.text, fontFamily: fonts.body, fontSize: 15, paddingVertical: 10, maxHeight: 120 }, noOutline]}
            />
          </View>
          <IconButton icon={Send} label="Send" tone="accent" size={44} onPress={() => void send()} />
        </View>
      ) : null}

      <Sheet visible={safety} onClose={() => setSafety(false)} title="Safety">
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Lock size={18} color={theme.positive} />
          <Text tone="secondary" style={{ flex: 1 }}>
            Messages and reactions in this chat are end-to-end encrypted with XMTP (MLS). HENSENG's servers can't read them.
          </Text>
        </View>
        {chat?.kind === "group" ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Users size={18} color={theme.textSecondary} />
            <Text tone="secondary" style={{ flex: 1 }}>{chat.memberCount} members can read new messages.</Text>
          </View>
        ) : null}
        <Button
          label="Report this chat"
          kind="secondary"
          icon={Flag}
          onPress={async () => {
            if (api.status === "ready") await api.request("POST", "/reports", { targetType: "chat", targetId: chat?.peerAddress ?? chatId, reason: "Reported from encrypted chat" }).catch(() => undefined);
            toast("Thanks. Reports never include message contents.", "success");
            setSafety(false);
          }}
        />
        <Button label="Block" kind="danger" icon={Ban} onPress={() => { setSafety(false); void setConsent("denied"); }} />
      </Sheet>
    </KeyboardAvoidingView>
  );
}
