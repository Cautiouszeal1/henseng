import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Bell, Lock, MessagesSquare, PenSquare, Plus, Users, X, Inbox } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "../api/api-context";
import { MESSAGING_TEST_MODE, useMessaging } from "../messaging/messaging-context";
import { shortAddr, type ChatSummary } from "../messaging/model";
import { useProfile } from "../profile/profile-context";
import { Avatar } from "../ui/avatar";
import { LogoMark } from "../ui/logo";
import { Sheet, useToast } from "../ui/overlays";
import { Button, EmptyState, ErrorState, Field, IconButton, PreviewBanner, SearchField, Skeleton, Tap, Text } from "../ui/primitives";
import { useLayout, useTheme } from "../ui/theme";
import { buttonGradient, radius } from "../ui/tokens";
import { ChatThreadLive, useChatTitle } from "./chat-thread-live";

type Filter = "all" | "unread" | "groups";

function when(d: Date) {
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const diff = (now.getTime() - d.getTime()) / 86_400_000;
  if (diff < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Row({ chat, unread, selected, onPress }: { chat: ChatSummary; unread: boolean; selected?: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const title = useChatTitle(chat);
  const at = chat.lastMessage?.sentAt ?? chat.createdAt;
  return (
    <Tap
      onPress={onPress}
      haptic={false}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${chat.lastMessage?.preview ?? "No messages yet"}${unread ? ". Unread" : ""}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.lg, backgroundColor: selected ? theme.accentSoft : "transparent" }}
    >
      <Avatar name={title} seed={chat.peerAddress ?? chat.id} size={54} square={chat.kind === "group"} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text variant="subheading" numberOfLines={1} style={{ flex: 1 }}>{title}</Text>
          <Text variant="label" style={{ color: unread ? theme.accent : theme.textTertiary }}>{when(at)}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {chat.lastMessage ? `${chat.lastMessage.fromMe ? "You: " : ""}${chat.lastMessage.preview}` : chat.kind === "group" ? `${chat.memberCount ?? 0} members` : "No messages yet"}
          </Text>
          {unread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.accent }} accessibilityLabel="Unread" /> : null}
        </View>
      </View>
    </Tap>
  );
}

function NewChatSheet({ visible, onClose, onOpen }: { visible: boolean; onClose: () => void; onOpen: (id: string) => void }) {
  const { theme } = useTheme();
  const { client, resolveTarget } = useMessaging();
  const toast = useToast();
  const [mode, setMode] = useState<"dm" | "group">("dm");
  const [input, setInput] = useState("");
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<{ address: `0x${string}`; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setInput("");
    setGroupName("");
    setMembers([]);
    setError(null);
    setBusy(false);
  };

  const resolveReachable = async () => {
    const r = await resolveTarget(input);
    if ("error" in r) return r;
    if (client && r.address === client.address) return { error: "That's your own address." };
    if (client && !(await client.canMessage(r.address))) {
      return { error: `${r.label === r.address ? shortAddr(r.address) : r.label} hasn't set up encrypted messaging yet. Invite them to HENSENG or any XMTP app.` };
    }
    return r;
  };

  const startDm = async () => {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const r = await resolveReachable();
      if ("error" in r) return setError(r.error);
      const id = await client.startDm(r.address);
      reset();
      onClose();
      onOpen(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the chat.");
    } finally {
      setBusy(false);
    }
  };

  const addMember = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await resolveReachable();
      if ("error" in r) return setError(r.error);
      if (members.some((m) => m.address === r.address)) return setError("Already added.");
      setMembers((m) => [...m, r]);
      setInput("");
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    if (!client || !members.length) return;
    setBusy(true);
    setError(null);
    try {
      const id = await client.createGroup(members.map((m) => m.address), groupName.trim() || "Group chat");
      toast("Group created", "success");
      reset();
      onClose();
      onOpen(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the group.");
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title={mode === "dm" ? "New chat" : "New group"}>
      <View style={{ flexDirection: "row", gap: 8, padding: 4, borderRadius: radius.md, backgroundColor: theme.surface }}>
        {(["dm", "group"] as const).map((m) => (
          <Tap key={m} onPress={() => { setMode(m); setError(null); }} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.sm, backgroundColor: mode === m ? theme.card : "transparent" }}>
            <Text variant="bodyStrong" style={{ color: mode === m ? theme.text : theme.textSecondary }}>{m === "dm" ? "Direct message" : "Group"}</Text>
          </Tap>
        ))}
      </View>
      {mode === "group" ? <Field label="Group name" value={groupName} onChangeText={setGroupName} maxLength={60} placeholder="e.g. Weekend builders" /> : null}
      <Field
        label={mode === "dm" ? "To" : "Add people"}
        value={input}
        onChangeText={(v) => { setInput(v); setError(null); }}
        placeholder="0x… address, name.eth or @username"
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={() => void (mode === "dm" ? startDm() : addMember())}
        error={error}
      />
      {mode === "group" && members.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {members.map((m) => (
            <Tap key={m.address} onPress={() => setMembers((x) => x.filter((y) => y.address !== m.address))} accessibilityLabel={`Remove ${m.label}`} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 12, paddingRight: 8, height: 34, borderRadius: radius.full, backgroundColor: theme.accentSoft }}>
              <Text variant="caption" tone="accent">{m.label.startsWith("0x") ? shortAddr(m.label) : m.label}</Text>
              <X size={14} color={theme.accent} />
            </Tap>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Lock size={14} color={theme.positive} />
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>End-to-end encrypted with XMTP. Anyone with an XMTP-enabled wallet can be messaged, in HENSENG or another app.</Text>
      </View>
      {mode === "dm" ? (
        <Button label="Start chat" loading={busy} disabled={!input.trim()} onPress={() => void startDm()} />
      ) : (
        <>
          <Button label="Add person" kind="secondary" icon={Plus} loading={busy && !!input} disabled={!input.trim()} onPress={() => void addMember()} />
          <Button label={`Create group${members.length ? ` (${members.length + 1})` : ""}`} icon={Users} loading={busy && !input} disabled={!members.length} onPress={() => void createGroup()} />
        </>
      )}
    </Sheet>
  );
}

export function ChatsLive() {
  const { theme } = useTheme();
  const { isWide } = useLayout();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { me } = useApi();
  const { status, error, client, retry, version, lastRead, profileFor } = useMessaging();
  const [tab, setTab] = useState<"inbox" | "requests">("inbox");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [requests, setRequests] = useState<ChatSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [newChat, setNewChat] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    try {
      const [inbox, reqs] = await Promise.all([client.listChats("inbox"), client.listChats("requests")]);
      setChats(inbox);
      setRequests(reqs);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your chats.");
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const refresh = async () => {
    setRefreshing(true);
    await client?.sync().catch(() => undefined);
    await load();
    setRefreshing(false);
  };

  const isUnread = (c: ChatSummary) => !!c.lastMessage && !c.lastMessage.fromMe && c.lastMessage.sentAt.getTime() > (lastRead[c.id] ?? 0);
  const source = tab === "inbox" ? chats ?? [] : requests;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return source
      .filter((c) => (filter === "unread" ? isUnread(c) : filter === "groups" ? c.kind === "group" : true))
      .filter((c) => {
        if (!q) return true;
        const p = profileFor(c.peerAddress);
        return [c.title, c.peerAddress, p?.displayName, p?.username, c.lastMessage?.preview].some((s) => s?.toLowerCase().includes(q));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, filter, query, lastRead, profileFor]);
  const unreadCount = (chats ?? []).filter(isUnread).length;

  const open = (id: string) => (isWide ? setSelected(id) : router.push({ pathname: "/chat/[id]", params: { id } }));
  useEffect(() => {
    if (isWide && !selected && chats?.length) setSelected(chats[0]!.id);
  }, [isWide, selected, chats]);

  const header = (
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
      {MESSAGING_TEST_MODE ? <PreviewBanner text="Test mode: simulated chats and replies. Nothing is encrypted or sent anywhere." /> : null}
      <SearchField value={query} onChangeText={setQuery} placeholder="Search chats…" />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }} accessibilityRole="tablist">
        {([["all", "All", chats?.length], ["unread", "Unread", unreadCount], ["groups", "Groups", undefined]] as const).map(([f, label, count]) => {
          const active = tab === "inbox" && filter === f;
          return (
            <Tap key={f} onPress={() => { setTab("inbox"); setFilter(f); }} accessibilityRole="tab" accessibilityState={{ selected: active }} style={{ borderRadius: radius.full, overflow: "hidden" }}>
              {active ? (
                <LinearGradient colors={buttonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 36 }}>
                  <Text variant="bodyStrong" tone="inverse" style={{ fontSize: 14 }}>{label}</Text>
                  {count ? <Text variant="label" tone="inverse">{count}</Text> : null}
                </LinearGradient>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 36, backgroundColor: theme.surface, borderRadius: radius.full }}>
                  <Text variant="bodyStrong" tone="secondary" style={{ fontSize: 14 }}>{label}</Text>
                  {count ? <Text variant="label" tone="tertiary">{count}</Text> : null}
                </View>
              )}
            </Tap>
          );
        })}
        <Tap onPress={() => setTab("requests")} accessibilityRole="tab" accessibilityState={{ selected: tab === "requests" }} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 36, borderRadius: radius.full, backgroundColor: tab === "requests" ? theme.accent : theme.surface }}>
          <Inbox size={14} color={tab === "requests" ? "#FFF" : theme.textSecondary} />
          <Text variant="bodyStrong" style={{ fontSize: 14, color: tab === "requests" ? "#FFFFFF" : theme.textSecondary }}>Requests</Text>
          {requests.length ? <Text variant="label" style={{ color: tab === "requests" ? "#FFF" : theme.accent }}>{requests.length}</Text> : null}
        </Tap>
      </View>
    </View>
  );

  let content;
  if (status === "connecting") {
    content = (
      <View style={{ padding: 16, gap: 18 }}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <ActivityIndicator color={theme.accent} />
          <Text variant="caption" tone="secondary">Setting up end-to-end encryption on this device…</Text>
        </View>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <Skeleton width={54} height={54} radius={27} />
            <View style={{ flex: 1, gap: 8 }}><Skeleton width="50%" height={14} /><Skeleton width="80%" height={12} /></View>
          </View>
        ))}
      </View>
    );
  } else if (status === "error") {
    content = <View style={{ padding: 16 }}><ErrorState title="Encrypted messaging is unavailable" body={error ?? "Couldn't connect to XMTP."} onRetry={retry} /></View>;
  } else {
    content = (
      <FlatList
        data={shown}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: 100, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.accent} />}
        ListHeaderComponent={
          loadError ? <View style={{ padding: 12 }}><ErrorState title="Couldn't load chats" body={loadError} onRetry={() => void refresh()} /></View>
          : tab === "requests" ? <View style={{ padding: 12 }}><Text variant="caption" tone="secondary">Messages from people you haven't chatted with. They can't see that you've read them until you accept.</Text></View>
          : undefined
        }
        renderItem={({ item }) => <Row chat={item} unread={isUnread(item)} selected={isWide && item.id === selected} onPress={() => open(item.id)} />}
        ListEmptyComponent={
          chats === null ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={theme.accent} />
          ) : tab === "requests" ? (
            <EmptyState icon={Inbox} title="No message requests" body="When someone new messages you, it lands here first so you can decide." />
          ) : query || filter !== "all" ? (
            <EmptyState icon={MessagesSquare} title="No chats here" body={query ? `Nothing matches "${query}".` : "No chats match this filter."} />
          ) : (
            <EmptyState icon={Lock} title="Start your first encrypted chat" body="Message any wallet address, ENS name or HENSENG @username. Only you and they can read it." action={{ label: "New chat", onPress: () => setNewChat(true) }} />
          )
        }
      />
    );
  }

  const list = (
    <View style={{ flex: 1, paddingTop: isWide ? 28 : insets.top + 10 }}>
      {header}
      <View style={{ flex: 1 }}>{content}</View>
      {status === "ready" ? (
        <View style={{ position: "absolute", right: 20, bottom: 20 }}>
          <Tap onPress={() => setNewChat(true)} accessibilityRole="button" accessibilityLabel="New chat" style={{ borderRadius: 20, overflow: "hidden" }}>
            <LinearGradient colors={buttonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 58, height: 58, alignItems: "center", justifyContent: "center" }}>
              <PenSquare size={24} color="#FFFFFF" />
            </LinearGradient>
          </Tap>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: theme.bg }}>
      <View style={{ width: isWide ? 380 : "100%", borderRightWidth: isWide ? 1 : 0, borderRightColor: theme.border }}>{list}</View>
      {isWide ? (
        <View style={{ flex: 1 }}>
          {selected && status === "ready" ? (
            <ChatThreadLive key={selected} chatId={selected} embedded />
          ) : (
            <EmptyState icon={Lock} title="Your messages are private" body="Pick a chat, or start a new one. Everything here is end-to-end encrypted." />
          )}
        </View>
      ) : null}
      <NewChatSheet visible={newChat} onClose={() => setNewChat(false)} onOpen={open} />
    </View>
  );
}
