import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Flame, Lock, Plus, Search, Users } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { PREVIEW_COMMUNITIES, type PreviewCommunity } from "../../data/preview";
import { formatMembers } from "../../lib/format";
import { Avatar } from "../../ui/avatar";
import { Sheet } from "../../ui/overlays";
import { Button, Card, EmptyState, IconButton, Pill, PreviewBanner, SearchField, SectionHeader, Tap, Text } from "../../ui/primitives";
import { Screen } from "../../ui/screen";
import { useLayout, useTheme } from "../../ui/theme";
import { avatarGradients, radius } from "../../ui/tokens";


function gradientFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return avatarGradients[Math.abs(h) % avatarGradients.length]!;
}

function FeaturedCard({ c }: { c: PreviewCommunity }) {
  const g = gradientFor(c.id);
  return (
    <Tap onPress={() => router.push({ pathname: "/community/[id]", params: { id: c.id } })} accessibilityRole="button" accessibilityLabel={`${c.name}, ${formatMembers(c.members)} members`} style={{ borderRadius: radius.xl, overflow: "hidden" }}>
      <LinearGradient colors={["#2A1B5E", g[0], g[1], "#FF9A4D"]} locations={[0, 0.35, 0.75, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 180, padding: 20, justifyContent: "flex-end" }}>
        <View style={{ position: "absolute", right: -30, top: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.08)" }} />
        <View style={{ position: "absolute", right: 40, top: 30, width: 70, height: 70, borderRadius: 35, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }} />
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title" tone="inverse">{c.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Users size={14} color="rgba(255,255,255,0.85)" />
              <Text variant="caption" style={{ color: "rgba(255,255,255,0.85)" }}>{formatMembers(c.members)} members</Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}>
            <Text variant="bodyStrong" tone="inverse">{c.joined ? "Open" : "Join"}</Text>
          </View>
        </View>
      </LinearGradient>
    </Tap>
  );
}

function TrendingTile({ c }: { c: PreviewCommunity }) {
  const { theme } = useTheme();
  return (
    <Tap onPress={() => router.push({ pathname: "/community/[id]", params: { id: c.id } })} accessibilityRole="button" accessibilityLabel={c.name} style={{ width: 150, padding: 14, gap: 12, borderRadius: radius.lg, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}>
      <Avatar name={c.name} seed={c.id} size={52} square />
      <View style={{ gap: 2 }}>
        <Text variant="subheading" numberOfLines={1}>{c.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Users size={12} color={theme.textTertiary} />
          <Text variant="caption" tone="tertiary">{formatMembers(c.members)}</Text>
        </View>
      </View>
    </Tap>
  );
}

function CommunityRow({ c }: { c: PreviewCommunity }) {
  const { theme } = useTheme();
  return (
    <Tap onPress={() => router.push({ pathname: "/community/[id]", params: { id: c.id } })} accessibilityRole="button" accessibilityLabel={c.name} haptic={false} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 }}>
      <Avatar name={c.name} seed={c.id} size={50} square />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text variant="subheading" numberOfLines={1}>{c.name}</Text>
          {c.visibility === "private" ? <Lock size={13} color={theme.textTertiary} /> : null}
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={1}>{formatMembers(c.members)} members · {c.tagline}</Text>
      </View>
      {c.joined ? <Pill label="Joined" tone="accent" /> : <Pill label="Join" />}
    </Tap>
  );
}

export default function Communities() {
  const { isDesktop } = useLayout();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const featured = PREVIEW_COMMUNITIES.find((c) => c.featured)!;
  const trending = [...PREVIEW_COMMUNITIES].sort((a, b) => b.members - a.members).slice(1, 6);
  const joined = PREVIEW_COMMUNITIES.filter((c) => c.joined);
  const recommended = PREVIEW_COMMUNITIES.filter((c) => !c.joined && !c.featured);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? PREVIEW_COMMUNITIES.filter((c) => `${c.name} ${c.tagline} ${c.category}`.toLowerCase().includes(q)) : [];
  }, [query]);

  return (
    <Screen
      title="Communities"
      maxWidth={isDesktop ? 1040 : 760}
      right={
        <>
          <IconButton icon={Search} label="Search communities" onPress={() => setSearching((v) => !v)} />
          <IconButton icon={Plus} label="Create a community" onPress={() => setCreating(true)} />
        </>
      }
    >
      <View style={{ gap: 28 }}>
        <PreviewBanner text="Preview: sample communities. Creating and joining real communities arrives in Phase 2." />
        {searching ? (
          <View style={{ gap: 8 }}>
            <SearchField value={query} onChangeText={setQuery} placeholder="Search communities" />
            {query ? (
              results.length ? (
                <Card padded={false} style={{ paddingHorizontal: 16 }}>{results.map((c) => <CommunityRow key={c.id} c={c} />)}</Card>
              ) : (
                <EmptyState icon={Search} title="No communities found" body={`Nothing matches "${query}". Try a topic like DeFi or NFTs.`} />
              )
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 28 }}>
          <View style={{ flex: isDesktop ? 1.4 : undefined, gap: 28 }}>
            <FeaturedCard c={featured} />
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <Text variant="heading">Trending communities</Text>
                <Flame size={18} color="#FF9A4D" />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {trending.map((c) => <TrendingTile key={c.id} c={c} />)}
              </ScrollView>
            </View>
          </View>
          <View style={{ flex: isDesktop ? 1 : undefined, gap: 28 }}>
            <View>
              <SectionHeader title="Your communities" />
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {joined.length ? joined.map((c) => <CommunityRow key={c.id} c={c} />) : <EmptyState icon={Users} title="No communities yet" body="Join one to see it here." />}
              </Card>
            </View>
            <View>
              <SectionHeader title="Recommended for you" />
              <Card padded={false} style={{ paddingHorizontal: 16 }}>{recommended.map((c) => <CommunityRow key={c.id} c={c} />)}</Card>
            </View>
          </View>
        </View>
      </View>

      <Sheet visible={creating} onClose={() => setCreating(false)} title="Create a community">
        <EmptyState
          icon={Users}
          title="Community creation opens in Phase 2"
          body="You'll be able to create public or private communities with channels, roles, announcements and moderation tools."
        />
        <Button label="Got it" kind="secondary" onPress={() => setCreating(false)} />
      </Sheet>
    </Screen>
  );
}
