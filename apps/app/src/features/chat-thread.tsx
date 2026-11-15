import { router } from "expo-router";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CornerUpLeft,
  FileText,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Play,
  Send,
  Smile,
  Video,
  ArrowUpRight,
} from "lucide-react-native";
import { useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PreviewChat, PreviewMessage } from "../data/preview";
import { Avatar } from "../ui/avatar";
import { useToast } from "../ui/overlays";
import { IconButton, noOutline, PreviewBanner, Tap, Text } from "../ui/primitives";
import { useLayout, useTheme } from "../ui/theme";
import { buttonGradient, fonts, radius } from "../ui/tokens";
import { LinearGradient } from "expo-linear-gradient";

const REACTIONS = ["❤️", "👍", "🔥", "😂", "🙏"];

function Ticks({ status, color }: { status?: PreviewMessage["status"]; color: string }) {
  if (!status) return null;
  if (status === "sent") return <Check size={14} color={color} />;
  return <CheckCheck size={14} color={status === "read" ? "#9FD0FF" : color} />;
}

function Bubble({ m, onReply, onReact }: { m: PreviewMessage; onReply: () => void; onReact: (r: string) => void }) {
  const { theme } = useTheme();
  const mine = m.from === "me";
  const [showReactions, setShowReactions] = useState(false);
  const fg = mine ? "#FFFFFF" : theme.text;
  const sub = mine ? "rgba(255,255,255,0.75)" : theme.textTertiary;

  const body = (
    <View style={{ gap: 6 }}>
      {m.replyTo ? (
        <View style={{ borderLeftWidth: 3, borderLeftColor: mine ? "rgba(255,255,255,0.7)" : theme.accent, paddingLeft: 8, paddingVertical: 2, opacity: 0.9 }}>
          <Text variant="caption" style={{ color: sub }} numberOfLines={1}>{m.replyTo}</Text>
        </View>
      ) : null}
      {m.kind === "voice" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minWidth: 190 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: mine ? "rgba(255,255,255,0.22)" : theme.accent, alignItems: "center", justifyContent: "center" }}>
            <Play size={15} color="#FFFFFF" fill="#FFFFFF" />
          </View>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 2, height: 24 }}>
            {Array.from({ length: 26 }, (_, i) => (
              <View key={i} style={{ width: 2.5, borderRadius: 2, height: 5 + ((i * 7) % 17), backgroundColor: mine ? "rgba(255,255,255,0.7)" : theme.textTertiary }} />
            ))}
          </View>
          <Text variant="label" style={{ color: sub }}>{m.meta}</Text>
        </View>
      ) : m.kind === "file" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minWidth: 220 }}>
          <View style={{ width: 40, height: 46, borderRadius: 8, backgroundColor: mine ? "rgba(255,255,255,0.2)" : theme.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <FileText size={20} color={mine ? "#FFFFFF" : theme.accent} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text variant="bodyStrong" style={{ color: fg }} numberOfLines={2}>{m.text}</Text>
            <Text variant="caption" style={{ color: sub }}>{m.meta}</Text>
          </View>
        </View>
      ) : m.kind === "tx" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minWidth: 220 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: mine ? "rgba(255,255,255,0.2)" : theme.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <ArrowUpRight size={18} color={mine ? "#FFFFFF" : theme.accent} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text variant="bodyStrong" style={{ color: fg }} numberOfLines={2}>{m.text}</Text>
            <Text variant="caption" style={{ color: sub }}>{m.meta}</Text>
          </View>
        </View>
      ) : (
        <Text style={{ color: fg }}>{m.text}</Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" }}>
        <Text variant="label" style={{ color: sub, fontSize: 11 }}>{m.time}</Text>
        {mine ? <Ticks status={m.status} color={sub} /> : null}
      </View>
    </View>
  );

  const shape = {
    maxWidth: "100%" as const,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomRightRadius: mine ? 6 : 20,
    borderBottomLeftRadius: mine ? 20 : 6,
  };

  return (
    <Animated.View entering={FadeInUp.duration(220)} style={{ alignItems: mine ? "flex-end" : "flex-start", marginVertical: 4, paddingHorizontal: 16 }}>
      <Tap
        haptic
        onLongPress={() => setShowReactions((v) => !v)}
        onPress={() => showReactions && setShowReactions(false)}
        accessibilityHint="Long press to react or reply"
        style={{ maxWidth: "80%", alignItems: mine ? "flex-end" : "flex-start" }}
      >
        {mine ? (
          <LinearGradient colors={buttonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={shape}>
            {body}
          </LinearGradient>
        ) : (
          <View style={[shape, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>{body}</View>
        )}
      </Tap>
      {m.reactions?.length ? (
        <View style={{ flexDirection: "row", gap: 2, marginTop: -6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
          <Text variant="caption">{m.reactions.join(" ")}</Text>
          <Text variant="caption" tone="tertiary">{m.reactions.length}</Text>
        </View>
      ) : null}
      {showReactions ? (
        <View style={{ flexDirection: "row", gap: 4, marginTop: 6, padding: 6, borderRadius: radius.full, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong }}>
          {REACTIONS.map((r) => (
            <Tap key={r} onPress={() => { onReact(r); setShowReactions(false); }} accessibilityLabel={`React ${r}`} style={{ padding: 4 }}>
              <Text style={{ fontSize: 20 }}>{r}</Text>
            </Tap>
          ))}
          <Tap onPress={() => { onReply(); setShowReactions(false); }} accessibilityLabel="Reply" style={{ padding: 6 }}>
            <CornerUpLeft size={18} color={theme.text} />
          </Tap>
        </View>
      ) : null}
    </Animated.View>
  );
}

/**
 * Preview conversation view, used when encrypted messaging is off in a build.
 * It renders PREVIEW messages and keeps anything you type in memory only — nothing
 * is sent. Live chats use chat-thread-live.tsx (XMTP, end-to-end encrypted).
 */
export function ChatThread({ chat, embedded = false }: { chat: PreviewChat; embedded?: boolean }) {
  const { theme } = useTheme();
  const { isWide } = useLayout();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [messages, setMessages] = useState<PreviewMessage[]>(chat.messages);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const list = useRef<FlatList<PreviewMessage>>(null);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const now = new Date();
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), from: "me", text, time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`, status: "sent", replyTo: replyTo ?? undefined },
    ]);
    setDraft("");
    setReplyTo(null);
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
  };

  const soon = (what: string) => toast(`${what} needs encrypted messaging, which is off in this build.`, "info");

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: embedded || isWide ? 16 : insets.top + 6, paddingBottom: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.bg }}>
        {!embedded && <IconButton icon={ArrowLeft} label="Back" tone="plain" onPress={() => (router.canGoBack() ? router.back() : router.replace("/chats"))} />}
        <Avatar name={chat.name} size={44} presence={chat.presence} square={chat.group} />
        <View style={{ flex: 1 }}>
          <Text variant="subheading" numberOfLines={1}>{chat.name}</Text>
          <Text variant="caption" style={{ color: chat.presence === "online" ? theme.positive : theme.textTertiary }}>
            {chat.group ? `${chat.members} members` : chat.presence === "online" ? "Online" : chat.presence === "away" ? "Away" : "Last seen recently"}
          </Text>
        </View>
        <IconButton icon={Phone} label="Voice call" tone="plain" onPress={() => soon("Calling")} />
        <IconButton icon={Video} label="Video call" tone="plain" onPress={() => soon("Video calling")} />
        <IconButton icon={MoreVertical} label="More options" tone="plain" onPress={() => soon("Chat settings")} />
      </View>

      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingVertical: 12, gap: 2 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <PreviewBanner text="Preview conversation. Messages you type stay on this screen only and are not sent. Encrypted messaging is off in this build." />
          </View>
        }
        renderItem={({ item }) => (
          <Bubble
            m={item}
            onReply={() => setReplyTo(item.text ?? item.meta ?? "Message")}
            onReact={(r) => setMessages((prev) => prev.map((x) => (x.id === item.id ? { ...x, reactions: [...(x.reactions ?? []), r] } : x)))}
          />
        )}
        ListFooterComponent={
          chat.typing ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8 }}>
              <View style={{ flexDirection: "row", gap: 3, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: theme.card }}>
                {[0, 1, 2].map((i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.textTertiary }} />)}
              </View>
              <Text variant="caption" tone="tertiary">{chat.name.split(" ")[0]} is typing…</Text>
            </View>
          ) : undefined
        }
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
      />

      {replyTo ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 12, padding: 10, borderRadius: radius.md, backgroundColor: theme.surface, borderLeftWidth: 3, borderLeftColor: theme.accent }}>
          <CornerUpLeft size={16} color={theme.accent} />
          <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>Replying to: {replyTo}</Text>
          <Tap onPress={() => setReplyTo(null)} accessibilityLabel="Cancel reply"><Text variant="caption" tone="accent">Cancel</Text></Tap>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: embedded || isWide ? 16 : insets.bottom + 10 }}>
        <IconButton icon={Paperclip} label="Attach file" onPress={() => soon("Media and document sharing")} />
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", minHeight: 44, borderRadius: 22, paddingLeft: 16, paddingRight: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message…"
            placeholderTextColor={theme.textTertiary}
            multiline
            accessibilityLabel="Message"
            onSubmitEditing={send}
            style={[{ flex: 1, color: theme.text, fontFamily: fonts.body, fontSize: 15, paddingVertical: 10, maxHeight: 120 }, noOutline]}
          />
          <IconButton icon={Smile} label="Emoji" tone="plain" size={34} onPress={() => soon("Emoji picker")} />
        </View>
        {draft.trim() ? (
          <IconButton icon={Send} label="Send" tone="accent" size={44} onPress={send} />
        ) : (
          <IconButton icon={Mic} label="Record voice note" tone="accent" size={44} onPress={() => soon("Voice notes")} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
