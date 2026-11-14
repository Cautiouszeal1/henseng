import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Flame, Globe2, Lock, Plus, Search, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useApi, useApiQuery } from "../api/api-context";
import type { CommunityCard } from "../api/types";
import { formatMembers } from "../lib/format";
import { Avatar } from "../ui/avatar";
import { Sheet, useToast } from "../ui/overlays";
import { Button, Card, EmptyState, ErrorState, Field, IconButton, Pill, SearchField, SectionHeader, Skeleton, Tap, Text } from "../ui/primitives";
import { Screen } from "../ui/screen";
import { useLayout, useTheme } from "../ui/theme";
import { avatarGradients, radius } from "../ui/tokens";

const CATEGORIES = ["General", "Builders", "DeFi", "NFTs", "DAO", "Gaming", "Education"] as const;
const open = (slug: string) => router.push({ pathname: "/community/[id]", params: { id: slug } });

function Featured({ c }: { c: CommunityCard }) {
  const g = avatarGradients[c.avatarIndex % avatarGradients.length]!;
  return (
    <Tap onPress={() => open(c.slug)} accessibilityRole="button" accessibilityLabel={`${c.name}, ${formatMembers(c.memberCount)} members`} style={{ borderRadius: radius.xl, overflow: "hidden" }}>
      <LinearGradient colors={["#2A1B5E", g[0], g[1], "#FF9A4D"]} locations={[0, 0.35, 0.75, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 180, padding: 20, justifyContent: "flex-end" }}>
        <View style={{ position: "absolute", right: -30, top: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.08)" }} />
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title" tone="inverse" numberOfLines={1}>{c.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Users size={14} color="rgba(255,255,255,0.85)" />
              <Text variant="caption" style={{ color: "rgba(255,255,255,0.85)" }}>{formatMembers(c.memberCount)} member{c.memberCount === 1 ? "" : "s"}</Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}>
            <Text variant="bodyStrong" tone="inverse">{c.joined ? "Open" : "View"}</Text>
          </View>
        </View>
      </LinearGradient>
    </Tap>
  );
}

function Tile({ c }: { c: CommunityCard }) {
  const { theme } = useTheme();
  return (
    <Tap onPress={() => open(c.slug)} accessibilityRole="button" accessibilityLabel={c.name} style={{ width: 150, padding: 14, gap: 12, borderRadius: radius.lg, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}>
      <Avatar name={c.name} size={52} square gradientIndex={c.avatarIndex} />
      <View style={{ gap: 2 }}>
        <Text variant="subheading" numberOfLines={1}>{c.name}</Text>
        <Text variant="caption" tone="tertiary">{formatMembers(c.memberCount)} members</Text>
      </View>
    </Tap>
  );
}

export function CommunityRow({ c }: { c: CommunityCard }) {
  const { theme } = useTheme();
  return (
    <Tap onPress={() => open(c.slug)} haptic={false} accessibilityRole="button" accessibilityLabel={c.name} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 }}>
      <Avatar name={c.name} size={50} square gradientIndex={c.avatarIndex} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text variant="subheading" numberOfLines={1}>{c.name}</Text>
          {c.visibility === "PRIVATE" ? <Lock size={13} color={theme.textTertiary} /> : null}
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {formatMembers(c.memberCount)} member{c.memberCount === 1 ? "" : "s"}{c.tagline ? ` · ${c.tagline}` : ""}
        </Text>
      </View>
      {c.role === "OWNER" ? <Pill label="Owner" tone="accent" /> : c.joined ? <Pill label="Joined" tone="accent" /> : <Pill label={c.category} />}
    </Tap>
  );
}

function CreateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const { request } = useApi();
  const toast = useToast();
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("General");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await request<{ slug: string }>("POST", "/communities", { name, tagline, description, category, visibility });
      toast(`${name} is live`, "success");
      onClose();
      setName("");
      setTagline("");
      setDescription("");
      open(r.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the community.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Create a community">
      <Field label="Name" value={name} onChangeText={setName} maxLength={48} placeholder="e.g. Base Builders Lagos" />
      <Field label="Tagline" value={tagline} onChangeText={setTagline} maxLength={80} placeholder="One line about what you do" />
      <Field label="Description" value={description} onChangeText={setDescription} multiline maxLength={1000} style={{ minHeight: 90, textAlignVertical: "top" }} />
      <View style={{ gap: 8 }}>
        <Text variant="label" tone="secondary">Category</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CATEGORIES.map((c) => (
            <Tap key={c} onPress={() => setCategory(c)} accessibilityRole="radio" accessibilityState={{ checked: category === c }} style={{ paddingHorizontal: 14, height: 34, justifyContent: "center", borderRadius: radius.full, backgroundColor: category === c ? theme.accent : theme.surface }}>
              <Text variant="caption" style={{ color: category === c ? "#FFFFFF" : theme.textSecondary }}>{c}</Text>
            </Tap>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {([["PUBLIC", "Public", "Anyone can find and join", Globe2], ["PRIVATE", "Private", "Invite link required", Lock]] as const).map(([v, label, hint, Icon]) => (
          <Tap key={v} onPress={() => setVisibility(v)} accessibilityRole="radio" accessibilityState={{ checked: visibility === v }} style={{ flex: 1, padding: 14, gap: 6, borderRadius: radius.md, borderWidth: 1.5, borderColor: visibility === v ? theme.accent : theme.border, backgroundColor: visibility === v ? theme.accentSoft : "transparent" }}>
            <Icon size={18} color={visibility === v ? theme.accent : theme.textSecondary} />
            <Text variant="bodyStrong">{label}</Text>
            <Text variant="caption" tone="secondary">{hint}</Text>
          </Tap>
        ))}
      </View>
      <Text variant="caption" tone="tertiary">Community channels are stored on HENSENG servers and are not end-to-end encrypted. Use private chats for sensitive conversations.</Text>
      {error ? <Text variant="caption" tone="negative">{error}</Text> : null}
      <Button label="Create community" loading={busy} disabled={name.trim().length < 3} onPress={() => void submit()} />
    </Sheet>
  );
}

export function CommunitiesLive() {
  const { isDesktop } = useLayout();
  const { status, error: apiError, retry } = useApi();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const discover = useApiQuery<{ communities: CommunityCard[] }>("/communities");
  const joined = useApiQuery<{ communities: CommunityCard[] }>("/communities?scope=joined", [creating]);
  const results = useApiQuery<{ communities: CommunityCard[] }>(debounced ? `/communities?q=${encodeURIComponent(debounced)}` : null);

  const header = (
    <>
      <IconButton icon={Search} label="Search communities" onPress={() => setSearching((v) => !v)} />
      <IconButton icon={Plus} label="Create a community" onPress={() => setCreating(true)} />
    </>
  );

  if (status === "connecting") {
    return (
      <Screen title="Communities" right={header}>
        <View style={{ gap: 16 }}>
          <Skeleton width="100%" height={180} radius={28} />
          <Skeleton width="60%" height={20} />
          <Skeleton width="100%" height={70} radius={20} />
        </View>
      </Screen>
    );
  }
  if (status === "error") {
    return (
      <Screen title="Communities">
        <ErrorState title="Can't reach HENSENG" body={apiError ?? "Check your connection."} onRetry={retry} />
      </Screen>
    );
  }

  const all = discover.data?.communities ?? [];
  const mine = joined.data?.communities ?? [];
  const featured = all[0];
  const trending = all.slice(1, 7);
  const recommended = all.filter((c) => !c.joined).slice(0, 8);

  return (
    <Screen title="Communities" maxWidth={isDesktop ? 1040 : 760} right={header}>
      <View style={{ gap: 28 }}>
        {searching ? (
          <View style={{ gap: 8 }}>
            <SearchField value={query} onChangeText={setQuery} placeholder="Search communities" />
            {debounced ? (
              results.loading && !results.data ? (
                <ActivityIndicator />
              ) : results.data?.communities.length ? (
                <Card padded={false} style={{ paddingHorizontal: 16 }}>{results.data.communities.map((c) => <CommunityRow key={c.id} c={c} />)}</Card>
              ) : (
                <EmptyState icon={Search} title="No communities found" body={`Nothing matches "${debounced}". Try another name or topic.`} />
              )
            ) : null}
          </View>
        ) : null}

        {discover.error ? <ErrorState title="Couldn't load communities" body={discover.error} onRetry={() => void discover.reload()} /> : null}

        {!discover.loading && all.length === 0 && !discover.error ? (
          <Card>
            <EmptyState icon={Users} title="Start the first community" body="There are no public communities yet. Create one for your project, DAO or friends." action={{ label: "Create a community", onPress: () => setCreating(true) }} />
          </Card>
        ) : null}

        <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 28 }}>
          <View style={{ flex: isDesktop ? 1.4 : undefined, gap: 28 }}>
            {featured ? <Featured c={featured} /> : null}
            {trending.length ? (
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <Text variant="heading">Trending communities</Text>
                  <Flame size={18} color="#FF9A4D" />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                  {trending.map((c) => <Tile key={c.id} c={c} />)}
                </ScrollView>
              </View>
            ) : null}
          </View>
          <View style={{ flex: isDesktop ? 1 : undefined, gap: 28 }}>
            <View>
              <SectionHeader title="Your communities" />
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {mine.length ? mine.map((c) => <CommunityRow key={c.id} c={c} />) : <EmptyState icon={Users} title="No communities yet" body="Join or create one and it will appear here." />}
              </Card>
            </View>
            {recommended.length ? (
              <View>
                <SectionHeader title="Discover" />
                <Card padded={false} style={{ paddingHorizontal: 16 }}>{recommended.map((c) => <CommunityRow key={c.id} c={c} />)}</Card>
              </View>
            ) : null}
          </View>
        </View>
        {discover.loading && !discover.data ? <ActivityIndicator /> : null}
      </View>
      <CreateSheet visible={creating} onClose={() => setCreating(false)} />
    </Screen>
  );
}
