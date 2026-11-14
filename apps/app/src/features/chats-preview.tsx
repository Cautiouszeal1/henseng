import { router } from "expo-router";
import { MessageCirclePlus, MessagesSquare, PenSquare, Bell } from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PREVIEW_CHATS, type PreviewChat } from "../data/preview";
import { ChatThread } from "./chat-thread";
import { useApi } from "../api/api-context";
import { useProfile } from "../profile/profile-context";
import { Avatar } from "../ui/avatar";
import { LogoMark } from "../ui/logo";
import { Sheet } from "../ui/overlays";
import { Button, Counter, EmptyState, IconButton, PreviewBanner, SearchField, Tap, Text } from "../ui/primitives";
import { useLayout, useTheme } from "../ui/theme";
import { buttonGradient, radius } from "../ui/tokens";

type Filter = "all" | "unread" | "groups";

function FilterChip({ label, count, active, onPress }: { label: string; count?: number; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Tap onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} style={{ borderRadius: radius.full, overflow: "hidden" }}>
      {active ? (
        <LinearGradient colors={buttonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 36 }}>
          <Text variant="bodyStrong" tone="inverse" style={{ fontSize: 14 }}>{label}</Text>
          {count ? <View style={{ paddingHorizontal: 7, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.25)" }}><Text variant="label" tone="inverse">{count}</Text></View> : null}
        </LinearGradient>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 36, backgroundColor: theme.surface, borderRadius: radius.full }}>
          <Text variant="bodyStrong" tone="secondary" style={{ fontSize: 14 }}>{label}</Text>
          {count ? <Text variant="label" tone="tertiary">{count}</Text> : null}
        </View>
      )}
    </Tap>
  );
}

function ChatRow({ chat, selected, onPress }: { chat: PreviewChat; selected?: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Tap
      onPress={onPress}
      haptic={false}
      accessibilityRole="button"
      accessibilityLabel={`${chat.name}. ${chat.last}. ${chat.time}${chat.unread ? `. ${chat.unread} unread` : ""}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.lg, backgroundColor: selected ? theme.accentSoft : "transparent" }}
    >
      <Avatar name={chat.name} size={54} presence={chat.presence} square={chat.group} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text variant="subheading" numberOfLines={1} style={{ flex: 1 }}>{chat.name}</Text>
          <Text variant="label" style={{ color: chat.unread ? theme.accent : theme.textTertiary }}>{chat.time}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text variant="caption" numberOfLines={1} style={{ flex: 1, color: chat.typing ? theme.accent : theme.textSecondary }}>
            {chat.typing ? "typing…" : chat.last}
          </Text>
          {chat.unread ? <Counter value={chat.unread} /> : null}
        </View>
      </View>
    </Tap>
  );
}

export function ChatsPreview() {
  const { theme } = useTheme();
  const { isWide } = useLayout();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { me } = useApi();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string>(PREVIEW_CHATS[0]!.id);
  const [newChat, setNewChat] = useState(false);

  const chats = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PREVIEW_CHATS.filter((c) => (filter === "unread" ? c.unread > 0 : filter === "groups" ? c.group : true)).filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.last.toLowerCase().includes(q),
    );
  }, [query, filter]);
  const unreadCount = PREVIEW_CHATS.filter((c) => c.unread).length;

  const open = (id: string) => (isWide ? setSelected(id) : router.push({ pathname: "/chat/[id]", params: { id } }));

  const list = (
    <View style={{ flex: 1, paddingTop: isWide ? 28 : insets.top + 10 }}>
      <View style={{ paddingHorizontal: 16, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {!isWide && <LogoMark size={34} />}
          <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">Chats</Text>
          <IconButton icon={Bell} label="Notifications" badge={me?.unreadNotifications || undefined} onPress={() => router.push("/notifications")} />
          {!isWide && (
            <Tap onPress={() => router.push("/profile")} accessibilityLabel="Your profile" haptic={false}>
              <Avatar name={profile.displayName || "You"} size={40} presence={profile.showOnline ? "online" : undefined} gradientIndex={profile.avatarIndex} />
            </Tap>
          )}
        </View>
        <SearchField value={query} onChangeText={setQuery} placeholder="Search messages…" />
        <View style={{ flexDirection: "row", gap: 8 }} accessibilityRole="tablist">
          <FilterChip label="All" count={PREVIEW_CHATS.length} active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterChip label="Unread" count={unreadCount} active={filter === "unread"} onPress={() => setFilter("unread")} />
          <FilterChip label="Groups" active={filter === "groups"} onPress={() => setFilter("groups")} />
        </View>
      </View>
      <FlatList
        data={chats}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: 100 }}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingHorizontal: 12, paddingBottom: 6 }}>
            <PreviewBanner text="Preview: these are sample conversations. Encrypted chats with real contacts arrive in Phase 2." />
            {filter === "all" && !query ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingVertical: 4 }}>
                {PREVIEW_CHATS.filter((c) => !c.group).map((c) => (
                  <Tap key={c.id} onPress={() => open(c.id)} haptic={false} style={{ alignItems: "center", gap: 6, width: 64 }} accessibilityLabel={c.name}>
                    <Avatar name={c.name} size={56} ring presence={c.presence} />
                    <Text variant="label" tone="secondary" numberOfLines={1}>{c.name.split(" ")[0]}</Text>
                  </Tap>
                ))}
              </ScrollView>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <ChatRow chat={item} selected={isWide && item.id === selected} onPress={() => open(item.id)} />}
        ListEmptyComponent={<EmptyState icon={MessagesSquare} title="No chats here" body={query ? `Nothing matches "${query}".` : "Conversations that match this filter will show up here."} />}
      />
      <View style={{ position: "absolute", right: 20, bottom: 20 }}>
        <Tap onPress={() => setNewChat(true)} accessibilityRole="button" accessibilityLabel="New chat" style={{ borderRadius: 20, overflow: "hidden", shadowColor: "#8957FF", shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}>
          <LinearGradient colors={buttonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 58, height: 58, alignItems: "center", justifyContent: "center" }}>
            <PenSquare size={24} color="#FFFFFF" />
          </LinearGradient>
        </Tap>
      </View>
    </View>
  );

  const thread = PREVIEW_CHATS.find((c) => c.id === selected)!;

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: theme.bg }}>
      <View style={{ width: isWide ? 380 : "100%", borderRightWidth: isWide ? 1 : 0, borderRightColor: theme.border }}>{list}</View>
      {isWide && (
        <View style={{ flex: 1 }}>
          <ChatThread key={thread.id} chat={thread} embedded />
        </View>
      )}
      <Sheet visible={newChat} onClose={() => setNewChat(false)} title="New chat">
        <EmptyState
          icon={MessageCirclePlus}
          title="Start encrypted chats in Phase 2"
          body="You'll be able to message any wallet address, ENS name or HENSENG username with end-to-end encryption (XMTP)."
        />
        <Button label="Got it" kind="secondary" onPress={() => setNewChat(false)} />
      </Sheet>
    </View>
  );
}
