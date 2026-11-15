import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Hash, Lock, Megaphone, Share2, Users, SearchX } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PREVIEW_COMMUNITIES } from "../data/preview";
import { Avatar } from "../ui/avatar";
import { useToast } from "../ui/overlays";
import { Button, Card, EmptyState, IconButton, Pill, PreviewBanner, SectionHeader, Tap, Text } from "../ui/primitives";
import { Screen } from "../ui/screen";
import { useLayout, useTheme } from "../ui/theme";
import { avatarGradients, radius } from "../ui/tokens";
import { formatMembers } from "../lib/format";

const SAMPLE_MEMBERS = ["Amara Okafor", "Kenji Watanabe", "Sofia Mendes", "David Mensah", "Lina Haddad", "Tomás Ruiz"];

export function CommunityPreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = PREVIEW_COMMUNITIES.find((x) => x.id === id);
  const { theme } = useTheme();
  const { isWide } = useLayout();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [joined, setJoined] = useState(c?.joined ?? false);

  if (!c) {
    return (
      <Screen>
        <EmptyState icon={SearchX} title="Community not found" body="It may be private or no longer exist." action={{ label: "Back to communities", onPress: () => router.replace("/communities") }} />
      </Screen>
    );
  }
  const g = avatarGradients[c.id.length % avatarGradients.length]!;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <LinearGradient colors={["#2A1B5E", g[0], g[1], "#FF9A4D"]} locations={[0, 0.4, 0.8, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: isWide ? 240 : 190 + insets.top }}>
          <View style={{ position: "absolute", right: -40, top: 20, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(255,255,255,0.07)" }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: insets.top + 10, paddingHorizontal: 14 }}>
            <IconButton icon={ArrowLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/communities"))} />
            <IconButton icon={Share2} label="Share community" onPress={() => toast("Invite links need the HENSENG server, which this build isn't connected to.")} />
          </View>
        </LinearGradient>

        <View style={{ width: "100%", maxWidth: 820, alignSelf: "center", paddingHorizontal: 20, marginTop: -44, gap: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 14 }}>
            <View style={{ padding: 4, borderRadius: 26, backgroundColor: theme.bg }}>
              <Avatar name={c.name} seed={c.id} size={84} square />
            </View>
            <View style={{ flex: 1 }} />
            <Button
              label={joined ? "Joined" : "Join community"}
              kind={joined ? "secondary" : "primary"}
              size="md"
              onPress={() => {
                setJoined((v) => !v);
                toast(joined ? `Left ${c.name} (preview only)` : `Joined ${c.name} (preview only)`, "success");
              }}
            />
          </View>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text variant="title">{c.name}</Text>
              {c.visibility === "private" ? <Lock size={18} color={theme.textSecondary} /> : null}
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Pill label={`${formatMembers(c.members)} members`} icon={Users} />
              <Pill label={c.category} tone="accent" />
              <Pill label={c.visibility === "private" ? "Private" : "Public"} />
            </View>
            <Text tone="secondary">{c.description}</Text>
          </View>

          <PreviewBanner text="Preview community. Channels, announcements and members shown here are samples. Public community channels are not end-to-end encrypted; private groups will be." />

          {c.announcement ? (
            <Card style={{ flexDirection: "row", gap: 12, borderColor: theme.accent + "55" }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: theme.accentSoft, alignItems: "center", justifyContent: "center" }}>
                <Megaphone size={18} color={theme.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label" tone="accent">Announcement</Text>
                <Text>{c.announcement}</Text>
              </View>
            </Card>
          ) : null}

          <View>
            <SectionHeader title="Channels" />
            <Card padded={false}>
              {c.channels.map((ch, i) => (
                <Tap
                  key={ch.name}
                  haptic={false}
                  onPress={() => toast(ch.locked ? "This channel is for members with a role." : "Channel conversations need the HENSENG server, which this build isn't connected to.")}
                  accessibilityRole="button"
                  accessibilityLabel={`${ch.name} channel${ch.unread ? `, ${ch.unread} unread` : ""}`}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}
                >
                  {ch.locked ? <Lock size={18} color={theme.textTertiary} /> : <Hash size={18} color={theme.textSecondary} />}
                  <Text variant="bodyStrong" style={{ flex: 1, color: ch.unread ? theme.text : theme.textSecondary }}>{ch.name}</Text>
                  {ch.unread ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: theme.accent }}><Text variant="label" tone="inverse">{ch.unread}</Text></View> : null}
                </Tap>
              ))}
            </Card>
          </View>

          <View>
            <SectionHeader title="Members" action={`${formatMembers(c.members)} total`} />
            <Card style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              {SAMPLE_MEMBERS.map((m, i) => (
                <View key={m} style={{ alignItems: "center", gap: 6, width: 72 }}>
                  <Avatar name={m} size={52} presence={i % 3 === 0 ? "online" : undefined} />
                  <Text variant="label" tone="secondary" numberOfLines={1}>{m.split(" ")[0]}</Text>
                  {i === 0 ? <Text variant="label" tone="accent" style={{ fontSize: 10 }}>Admin</Text> : null}
                </View>
              ))}
            </Card>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
