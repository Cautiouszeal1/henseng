import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Flag, Hash, Lock, LogOut, Megaphone, Send, ShieldAlert, Trash2, UserPlus, Users, SearchX } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View, type ScrollViewInstance } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi, useApiQuery } from "../api/api-context";
import type { ChannelMessage, CommunityDetail, CommunityRole, Person } from "../api/types";
import { formatMembers } from "../lib/format";
import { OrbitArt, ScreenGlow } from "../ui/art";
import { Avatar } from "../ui/avatar";
import { Sheet, useToast } from "../ui/overlays";
import { Button, Card, EmptyState, ErrorState, IconButton, noOutline, Pill, SectionHeader, Skeleton, Tap, Text } from "../ui/primitives";
import { useLayout, useTheme } from "../ui/theme";
import { avatarGradients, fonts, radius } from "../ui/tokens";

const RANK: Record<CommunityRole, number> = { OWNER: 4, ADMIN: 3, MODERATOR: 2, MEMBER: 1 };
const nameOf = (p: Person) => p.displayName || (p.username ? `@${p.username}` : p.address ? `${p.address.slice(0, 6)}…${p.address.slice(-4)}` : "Member");

function time(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function MessageRow({ m, mine, canDelete, onDelete, onReport }: { m: ChannelMessage; mine: boolean; canDelete: boolean; onDelete: () => void; onReport: () => void }) {
  const { theme } = useTheme();
  const [menu, setMenu] = useState(false);
  return (
    <Animated.View entering={FadeInUp.duration(200)} style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
      <Avatar name={nameOf(m.author)} size={38} gradientIndex={m.author.avatarIndex} />
      <Tap haptic onLongPress={() => setMenu((v) => !v)} onPress={() => menu && setMenu(false)} accessibilityHint="Long press for message options" style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text variant="bodyStrong" style={{ color: mine ? theme.accent : theme.text }}>{nameOf(m.author)}</Text>
          {m.author.role && m.author.role !== "MEMBER" ? <Pill label={m.author.role.toLowerCase()} tone={m.author.role === "OWNER" ? "accent" : "neutral"} /> : null}
          <Text variant="label" tone="tertiary">{time(m.createdAt)}</Text>
        </View>
        {m.deleted ? <Text variant="caption" tone="tertiary" style={{ fontStyle: "italic" }}>Message deleted</Text> : <Text selectable>{m.body}</Text>}
        {menu && !m.deleted ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            {canDelete ? (
              <Tap onPress={() => { setMenu(false); onDelete(); }} accessibilityRole="button" style={{ flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, backgroundColor: theme.negative + "1A" }}>
                <Trash2 size={14} color={theme.negative} />
                <Text variant="caption" tone="negative">Delete</Text>
              </Tap>
            ) : null}
            {!mine ? (
              <Tap onPress={() => { setMenu(false); onReport(); }} accessibilityRole="button" style={{ flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, backgroundColor: theme.surface }}>
                <Flag size={14} color={theme.textSecondary} />
                <Text variant="caption" tone="secondary">Report</Text>
              </Tap>
            ) : null}
          </View>
        ) : null}
      </Tap>
    </Animated.View>
  );
}

function ChannelView({ slug, community, channelId, myId }: { slug: string; community: CommunityDetail; channelId: string; myId: string }) {
  const { theme } = useTheme();
  const { isWide } = useLayout();
  const insets = useSafeAreaInsets();
  const { request } = useApi();
  const toast = useToast();
  const channel = community.channels.find((c) => c.id === channelId)!;
  const [messages, setMessages] = useState<ChannelMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const latest = useRef<string | null>(null);

  const load = useCallback(
    async (incremental: boolean) => {
      try {
        const q = incremental && latest.current ? `?after=${encodeURIComponent(latest.current)}` : "";
        const r = await request<{ messages: ChannelMessage[] }>("GET", `/communities/${slug}/channels/${channelId}/messages${q}`);
        setError(null);
        setMessages((prev) => {
          const merged = incremental && prev ? [...prev, ...r.messages.filter((m) => !prev.some((p) => p.id === m.id))] : r.messages;
          latest.current = merged.at(-1)?.createdAt ?? latest.current;
          return merged;
        });
      } catch (e) {
        if (!incremental) setError(e instanceof Error ? e.message : "Couldn't load messages.");
      }
    },
    [request, slug, channelId],
  );

  // Live updates: poll for new messages every 4 seconds while the channel is open.
  useEffect(() => {
    latest.current = null;
    setMessages(null);
    void load(false);
    const t = setInterval(() => void load(true), 4000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const r = await request<{ message: ChannelMessage }>("POST", `/communities/${slug}/channels/${channelId}/messages`, { body });
      setDraft("");
      setMessages((prev) => [...(prev ?? []), r.message]);
      latest.current = r.message.createdAt;
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Message not sent.", "error");
    } finally {
      setSending(false);
    }
  };

  const myRank = community.role ? RANK[community.role] : 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingVertical: 12 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {channel.kind === "ANNOUNCEMENTS" ? <Megaphone size={18} color={theme.accent} /> : <Hash size={18} color={theme.textSecondary} />}
            <Text variant="heading">{channel.name}</Text>
          </View>
          <Text variant="caption" tone="tertiary">
            {channel.kind === "ANNOUNCEMENTS" ? "Only admins can post here. Members are notified." : "Public channel · not end-to-end encrypted"}
          </Text>
        </View>
        {error ? <View style={{ padding: 16 }}><ErrorState title="Couldn't load messages" body={error} onRetry={() => void load(false)} /></View> : null}
        {messages === null && !error ? (
          <View style={{ padding: 16, gap: 14 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} width="80%" height={44} radius={12} />)}
          </View>
        ) : messages && messages.length === 0 ? (
          <EmptyState icon={channel.kind === "ANNOUNCEMENTS" ? Megaphone : Hash} title={`Welcome to #${channel.name}`} body={channel.canPost ? "Be the first to say something." : "Nothing has been posted yet."} />
        ) : (
          messages?.map((m) => (
            <MessageRow
              key={m.id}
              m={m}
              mine={m.author.id === myId}
              canDelete={m.author.id === myId || (myRank >= RANK.MODERATOR && myRank > (m.author.role ? RANK[m.author.role] : 0))}
              onDelete={async () => {
                try {
                  await request("DELETE", `/messages/${m.id}`);
                  setMessages((prev) => prev?.map((x) => (x.id === m.id ? { ...x, deleted: true, body: null } : x)) ?? null);
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Couldn't delete.", "error");
                }
              }}
              onReport={async () => {
                await request("POST", "/reports", { targetType: "message", targetId: m.id, reason: "Reported from app" }).catch(() => undefined);
                toast("Thanks. Our team will review this message.", "success");
              }}
            />
          ))
        )}
      </ScrollView>
      {community.joined ? (
        channel.canPost ? (
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: isWide ? 16 : insets.bottom + 10, borderTopWidth: 1, borderTopColor: theme.border }}>
            <View style={{ flex: 1, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={`Message #${channel.name}`}
                placeholderTextColor={theme.textTertiary}
                multiline
                maxLength={4000}
                accessibilityLabel={`Message ${channel.name}`}
                onSubmitEditing={() => void send()}
                style={[{ color: theme.text, fontFamily: fonts.body, fontSize: 15, paddingVertical: 10, maxHeight: 120 }, noOutline]}
              />
            </View>
            {sending ? <ActivityIndicator style={{ width: 44, height: 44 }} color={theme.accent} /> : <IconButton icon={Send} label="Send" tone="accent" size={44} onPress={() => void send()} />}
          </View>
        ) : (
          <View style={{ padding: 16, paddingBottom: isWide ? 16 : insets.bottom + 12, borderTopWidth: 1, borderTopColor: theme.border }}>
            <Text variant="caption" tone="tertiary" style={{ textAlign: "center" }}>Only admins can post in #{channel.name}.</Text>
          </View>
        )
      ) : null}
    </View>
  );
}

export function CommunityLive({ slug }: { slug: string }) {
  const { theme } = useTheme();
  const { isWide } = useLayout();
  const insets = useSafeAreaInsets();
  const { request, me, status } = useApi();
  const toast = useToast();
  const { data: c, error, loading, reload } = useApiQuery<CommunityDetail>(`/communities/${slug}`);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteSheet, setInviteSheet] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [memberSheet, setMemberSheet] = useState<(Person & { role: CommunityRole }) | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);

  useEffect(() => {
    if (c && !channelId) setChannelId(c.channels.find((x) => x.kind === "TEXT")?.id ?? c.channels[0]?.id ?? null);
  }, [c, channelId]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/communities"));

  if (status !== "ready" || (loading && !c)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: 20, paddingTop: insets.top + 20, gap: 16 }}>
        <Skeleton width="100%" height={160} radius={24} />
        <Skeleton width="50%" height={24} />
        <Skeleton width="100%" height={80} radius={16} />
      </View>
    );
  }
  if (error || !c) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + 20, padding: 20 }}>
        <EmptyState icon={SearchX} title="Community not found" body={error ?? "It may be private or no longer exist."} action={{ label: "Back to communities", onPress: back }} />
      </View>
    );
  }

  const g = avatarGradients[c.avatarIndex % avatarGradients.length]!;
  const myRank = c.role ? RANK[c.role] : 0;

  const join = async (code?: string) => {
    setBusy(true);
    try {
      await request("POST", `/communities/${slug}/join`, code ? { inviteCode: code } : {});
      toast(`Welcome to ${c.name}`, "success");
      setInviteSheet(false);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't join.", "error");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await request("POST", `/communities/${slug}/leave`);
      toast(`You left ${c.name}`, "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't leave.", "error");
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    try {
      const r = await request<{ code: string }>("POST", `/communities/${slug}/invites`);
      await Clipboard.setStringAsync(`henseng://community/${slug}?invite=${r.code}`);
      toast("Invite link copied. It works for 7 days, up to 50 people.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't create an invite.", "error");
    }
  };

  const header = (
    <View>
      <OrbitArt seed={c.slug} style={{ width: "100%", height: isWide ? 170 : 150 + insets.top, aspectRatio: undefined }}>
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
          <LinearGradient colors={["rgba(16,16,20,0)", theme.bg]} locations={[0.55, 1]} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: (isWide ? 14 : insets.top + 10), paddingHorizontal: 14 }}>
            <IconButton icon={ArrowLeft} label="Back" onPress={back} />
            {c.joined ? <IconButton icon={UserPlus} label="Copy invite link" onPress={() => void invite()} /> : null}
          </View>
        </View>
      </OrbitArt>
      <View style={{ paddingHorizontal: 20, marginTop: -40, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
          <View style={{ padding: 4, borderRadius: 26, backgroundColor: theme.bg }}>
            <Avatar name={c.name} seed={c.slug} size={76} square />
          </View>
          <View style={{ flex: 1 }} />
          {c.banned ? (
            <Pill label="You can't join" tone="negative" />
          ) : c.joined ? (
            c.role !== "OWNER" ? <Button label="Leave" kind="secondary" size="md" icon={LogOut} loading={busy} onPress={() => void leave()} /> : <Pill label="Owner" tone="accent" />
          ) : c.visibility === "PRIVATE" ? (
            <Button label="Join with invite" size="md" onPress={() => setInviteSheet(true)} />
          ) : (
            <Button label="Join community" size="md" loading={busy} onPress={() => void join()} />
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text variant="title" numberOfLines={2} style={{ flexShrink: 1 }}>{c.name}</Text>
          {c.visibility === "PRIVATE" ? <Lock size={18} color={theme.textSecondary} /> : null}
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {c.members.length && !isWide ? (
            <Tap onPress={() => setMembersOpen(true)} accessibilityRole="button" accessibilityLabel="View members" haptic={false}>
              <Pill label={`${formatMembers(c.memberCount)} member${c.memberCount === 1 ? "" : "s"} · View`} icon={Users} tone="accent" />
            </Tap>
          ) : (
            <Pill label={`${formatMembers(c.memberCount)} member${c.memberCount === 1 ? "" : "s"}`} icon={Users} />
          )}
          <Pill label={c.category} tone="accent" />
          {c.role ? <Pill label={`You: ${c.role.toLowerCase()}`} tone="positive" /> : null}
        </View>
        {c.tagline ? <Text variant="bodyStrong" tone="secondary">{c.tagline}</Text> : null}
        {c.description ? <Text tone="secondary">{c.description}</Text> : null}
      </View>
    </View>
  );

  const channelsList = c.channels.length ? (
    <View style={{ paddingHorizontal: 12, gap: 2 }}>
      <Text variant="label" tone="tertiary" style={{ paddingHorizontal: 8, paddingVertical: 8 }}>CHANNELS</Text>
      {c.channels.map((ch) => (
        <Tap key={ch.id} onPress={() => setChannelId(ch.id)} haptic={false} accessibilityRole="tab" accessibilityState={{ selected: ch.id === channelId }} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: radius.md, backgroundColor: ch.id === channelId ? theme.accentSoft : "transparent" }}>
          {ch.kind === "ANNOUNCEMENTS" ? <Megaphone size={17} color={ch.id === channelId ? theme.accent : theme.textSecondary} /> : <Hash size={17} color={ch.id === channelId ? theme.accent : theme.textSecondary} />}
          <Text variant="bodyStrong" style={{ color: ch.id === channelId ? theme.text : theme.textSecondary }}>{ch.name}</Text>
        </Tap>
      ))}
    </View>
  ) : (
    <View style={{ padding: 20 }}>
      <Card style={{ alignItems: "center", gap: 8 }}>
        <Lock size={22} color={theme.textSecondary} />
        <Text variant="bodyStrong">Private community</Text>
        <Text variant="caption" tone="secondary" style={{ textAlign: "center" }}>Channels and members are only visible to members.</Text>
      </Card>
    </View>
  );

  const membersList = c.members.length ? (
    <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
      <SectionHeader title="Members" action={`${c.memberCount} total`} />
      <Card padded={false}>
        {c.members.map((m, i) => (
          <Tap
            key={m.id}
            haptic={false}
            disabled={!(myRank >= RANK.MODERATOR && myRank > RANK[m.role] && m.id !== me?.id)}
            dimDisabled={false}
            onPress={() => {
              setMembersOpen(false);
              setMemberSheet(m);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${nameOf(m)}, ${m.role.toLowerCase()}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}
          >
            <Avatar name={nameOf(m)} size={36} gradientIndex={m.avatarIndex} />
            <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{nameOf(m)}{m.id === me?.id ? " (you)" : ""}</Text>
            {m.role !== "MEMBER" ? <Pill label={m.role.toLowerCase()} tone={m.role === "OWNER" ? "accent" : "neutral"} /> : null}
          </Tap>
        ))}
      </Card>
    </View>
  ) : null;

  const channelPane = channelId && c.channels.some((x) => x.id === channelId) && me ? <ChannelView key={channelId} slug={slug} community={c} channelId={channelId} myId={me.id} /> : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {theme.mode === "dark" ? <ScreenGlow intensity={0.6} /> : null}
      {isWide ? (
        <View style={{ flex: 1, flexDirection: "row" }}>
          <ScrollView style={{ width: 340, flexGrow: 0, borderRightWidth: 1, borderRightColor: theme.border }} contentContainerStyle={{ paddingBottom: 24 }}>
            {header}
            <View style={{ height: 16 }} />
            {channelsList}
            {membersList}
          </ScrollView>
          <View style={{ flex: 1 }}>{channelPane ?? <EmptyState icon={Hash} title="No channel selected" body="Pick a channel on the left." />}</View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ maxHeight: "48%" }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
              {header}
              <View style={{ height: 8 }} />
              {c.channels.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 8 }}>
                  {c.channels.map((ch) => (
                    <Tap key={ch.id} onPress={() => setChannelId(ch.id)} accessibilityRole="tab" accessibilityState={{ selected: ch.id === channelId }} style={{ flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 14, height: 36, borderRadius: radius.full, backgroundColor: ch.id === channelId ? theme.accent : theme.surface }}>
                      {ch.kind === "ANNOUNCEMENTS" ? <Megaphone size={14} color={ch.id === channelId ? "#FFF" : theme.textSecondary} /> : <Hash size={14} color={ch.id === channelId ? "#FFF" : theme.textSecondary} />}
                      <Text variant="caption" style={{ color: ch.id === channelId ? "#FFFFFF" : theme.textSecondary }}>{ch.name}</Text>
                    </Tap>
                  ))}
                </ScrollView>
              ) : (
                channelsList
              )}
            </ScrollView>
          </View>
          <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: theme.border }}>{channelPane}</View>
        </View>
      )}

      <Sheet visible={membersOpen} onClose={() => setMembersOpen(false)} title="Members">
        <View style={{ marginHorizontal: -20 }}>{membersList}</View>
      </Sheet>

      <Sheet visible={inviteSheet} onClose={() => setInviteSheet(false)} title="Join with an invite">
        <Text tone="secondary">{c.name} is private. Paste the invite code an admin shared with you.</Text>
        <View style={{ minHeight: 52, borderRadius: radius.md, paddingHorizontal: 16, justifyContent: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
          <TextInput value={inviteCode} onChangeText={(v) => setInviteCode(v.trim().replace(/^.*invite=/, ""))} placeholder="Invite code or link" placeholderTextColor={theme.textTertiary} autoCapitalize="none" accessibilityLabel="Invite code" style={[{ color: theme.text, fontFamily: fonts.body, fontSize: 16 }, noOutline]} />
        </View>
        <Button label="Join" loading={busy} disabled={!inviteCode} onPress={() => void join(inviteCode)} />
      </Sheet>

      <Sheet visible={!!memberSheet} onClose={() => setMemberSheet(null)} title={memberSheet ? nameOf(memberSheet) : ""}>
        {memberSheet ? (
          <>
            <Text tone="secondary">Current role: {memberSheet.role.toLowerCase()}</Text>
            {myRank >= RANK.ADMIN && memberSheet.role === "MEMBER" ? (
              <Button label="Make moderator" kind="secondary" onPress={async () => { await request("POST", `/communities/${slug}/members/${memberSheet.id}/role`, { role: "MODERATOR" }).catch((e: Error) => toast(e.message, "error")); setMemberSheet(null); await reload(); }} />
            ) : null}
            {myRank > RANK.ADMIN && memberSheet.role !== "ADMIN" ? (
              <Button label="Make admin" kind="secondary" onPress={async () => { await request("POST", `/communities/${slug}/members/${memberSheet.id}/role`, { role: "ADMIN" }).catch((e: Error) => toast(e.message, "error")); setMemberSheet(null); await reload(); }} />
            ) : null}
            {myRank >= RANK.ADMIN && memberSheet.role !== "MEMBER" ? (
              <Button label="Remove role" kind="secondary" onPress={async () => { await request("POST", `/communities/${slug}/members/${memberSheet.id}/role`, { role: "MEMBER" }).catch((e: Error) => toast(e.message, "error")); setMemberSheet(null); await reload(); }} />
            ) : null}
            <Button
              label="Ban from community"
              kind="danger"
              icon={ShieldAlert}
              onPress={async () => {
                try {
                  await request("POST", `/communities/${slug}/members/${memberSheet.id}/ban`, {});
                  toast(`${nameOf(memberSheet)} was removed and banned`, "success");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Couldn't ban.", "error");
                }
                setMemberSheet(null);
                await reload();
              }}
            />
          </>
        ) : null}
      </Sheet>
    </KeyboardAvoidingView>
  );
}
