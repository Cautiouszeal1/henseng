import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { IN_APP_BROWSER } from "../../dapp/dapp-webview";
import { Bookmark, BookmarkCheck, Clock, Globe, ShieldCheck, VenetianMask, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { useBrowserState } from "../../data/browser-history";
import { DAPPS, type Dapp, type DappCategory } from "../../data/dapps";
import { useToast } from "../../ui/overlays";
import { OrbitArt } from "../../ui/art";
import { Avatar } from "../../ui/avatar";
import { Card, EmptyState, SearchField, SectionHeader, Tap, Text } from "../../ui/primitives";
import { Screen } from "../../ui/screen";
import { useLayout, useTheme } from "../../ui/theme";
import { radius } from "../../ui/tokens";

const CATEGORIES: ("All" | DappCategory)[] = ["All", "DeFi", "NFTs", "Bridges", "Tools", "Social"];

/** HENSENG artwork tile with the app's initial — we don't reproduce other projects' logos. */
function DappIcon({ d, size = 48 }: { d: Dapp; size?: number }) {
  return <Avatar name={d.name} seed={`dapp:${d.id}`} size={size} square />;
}

/** Accepts only https URLs; anything else is treated as a search term. */
function toSafeUrl(input: string): string | null {
  const t = input.trim();
  if (!/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(t) && !/^https:\/\//i.test(t)) return null;
  try {
    const u = new URL(/^https:\/\//i.test(t) ? t : `https://${t}`);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export default function Explore() {
  const { theme } = useTheme();
  const { isDesktop } = useLayout();
  const toast = useToast();
  const browser = useBrowserState();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");

  // iOS/Android: HENSENG's own browser, with the wallet connected. Web and the extension can't
  // embed other sites, so there they open in a normal tab.
  const openUrl = async (url: string) => {
    if (IN_APP_BROWSER) router.push({ pathname: "/browser", params: { url } });
    else await WebBrowser.openBrowserAsync(url, { toolbarColor: "#101014", controlsColor: "#8957FF" });
  };
  const open = async (d: Dapp) => {
    browser.recordVisit(d.id);
    await openUrl(d.url);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DAPPS.filter((d) => (category === "All" || d.category === category) && (!q || `${d.name} ${d.description} ${d.category}`.toLowerCase().includes(q)));
  }, [query, category]);
  const typedUrl = toSafeUrl(query);
  const featured = DAPPS.filter((d) => d.featured);
  const recent = browser.recent.map((id) => DAPPS.find((d) => d.id === id)).filter(Boolean) as Dapp[];
  const bookmarks = browser.bookmarks.map((id) => DAPPS.find((d) => d.id === id)).filter(Boolean) as Dapp[];

  const row = (d: Dapp, i: number) => {
    const saved = browser.bookmarks.includes(d.id);
    return (
      <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
        <Tap onPress={() => void open(d)} haptic={false} accessibilityRole="link" accessibilityLabel={`Open ${d.name}`} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <DappIcon d={d} size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subheading">{d.name}</Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>{d.description}</Text>
          </View>
        </Tap>
        <Tap onPress={() => browser.toggleBookmark(d.id)} accessibilityLabel={saved ? `Remove ${d.name} bookmark` : `Bookmark ${d.name}`} style={{ padding: 8 }}>
          {saved ? <BookmarkCheck size={20} color={theme.accent} /> : <Bookmark size={20} color={theme.textTertiary} />}
        </Tap>
      </View>
    );
  };

  return (
    <Screen title="Explore" maxWidth={isDesktop ? 1080 : 760}>
      <View style={{ gap: 26 }}>
        <View style={{ gap: 10 }}>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search dApps or enter a website" />
          {typedUrl ? (
            <Tap onPress={() => void openUrl(typedUrl)} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: theme.surface }}>
              <Globe size={18} color={theme.accent} />
              <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>Open {typedUrl}</Text>
            </Tap>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 }}>
            <VenetianMask size={16} color={browser.incognito ? theme.accent : theme.textTertiary} />
            <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
              {browser.incognito ? "Incognito: visits aren't added to your history." : "History is kept on this device only, never on our servers."}
            </Text>
            <Switch value={browser.incognito} onValueChange={browser.setIncognito} trackColor={{ true: theme.accent, false: theme.surface }} thumbColor="#FFFFFF" accessibilityLabel="Incognito browsing" />
          </View>
        </View>

        {!query ? (
          <View>
            <SectionHeader title="Featured" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {featured.map((d) => (
                <Tap key={d.id} onPress={() => void open(d)} accessibilityRole="link" accessibilityLabel={`Open ${d.name}`} style={{ width: 260, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
                  <OrbitArt seed={`dapp:${d.id}`} aspect={1.7}>
                    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, justifyContent: "flex-end" }}>
                      <LinearGradient colors={["rgba(10,9,20,0)", "rgba(10,9,20,0.82)"]} style={{ padding: 16, paddingTop: 40, flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <DappIcon d={d} size={40} />
                        <View style={{ flex: 1 }}>
                          <Text variant="heading" tone="inverse">{d.name}</Text>
                          <Text variant="caption" style={{ color: "rgba(255,255,255,0.8)" }} numberOfLines={1}>{d.description}</Text>
                        </View>
                      </LinearGradient>
                    </View>
                  </OrbitArt>
                </Tap>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="tablist">
          {CATEGORIES.map((c) => (
            <Tap key={c} onPress={() => setCategory(c)} accessibilityRole="tab" accessibilityState={{ selected: category === c }} style={{ paddingHorizontal: 16, height: 36, justifyContent: "center", borderRadius: radius.full, overflow: "hidden", backgroundColor: category === c ? undefined : theme.surface, borderWidth: 1, borderColor: category === c ? "rgba(255,255,255,0.18)" : theme.border }}>
              {category === c ? <LinearGradient colors={["#8957FF", "#397BFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} /> : null}
              <Text variant="bodyStrong" style={{ fontSize: 14, color: category === c ? "#FFFFFF" : theme.textSecondary }}>{c}</Text>
            </Tap>
          ))}
        </ScrollView>

        <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 26 }}>
          <View style={{ flex: isDesktop ? 1.3 : undefined }}>
            <SectionHeader title={query ? "Results" : category === "All" ? "Popular dApps" : category} />
            <Card padded={false}>
              {filtered.length ? filtered.map(row) : <EmptyState icon={Globe} title="No dApps found" body="Try another name, or type a full website address to open it." />}
            </Card>
          </View>
          {!query ? (
            <View style={{ flex: isDesktop ? 1 : undefined, gap: 26 }}>
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text variant="heading">Recently visited</Text>
                  {recent.length ? (
                    <Tap onPress={() => { browser.clearHistory(); toast("History cleared", "success"); }} accessibilityRole="button" style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                      <X size={14} color={theme.textSecondary} />
                      <Text variant="caption" tone="secondary">Clear</Text>
                    </Tap>
                  ) : null}
                </View>
                <Card padded={false}>{recent.length ? recent.map(row) : <EmptyState icon={Clock} title="Nothing yet" body="dApps you open will appear here." />}</Card>
              </View>
              <View>
                <SectionHeader title="Bookmarks" />
                <Card padded={false}>{bookmarks.length ? bookmarks.map(row) : <EmptyState icon={Bookmark} title="No bookmarks" body="Tap the bookmark icon on any dApp to save it." />}</Card>
              </View>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: theme.surface }}>
          <ShieldCheck size={18} color={theme.positive} />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            {IN_APP_BROWSER
              ? "dApps open inside HENSENG, over HTTPS only, with your wallet ready to connect. You approve every connection, signature and transaction. Listing an app here is not an endorsement."
              : "On the web and in the Chrome extension, dApps open in a new browser tab. Use the HENSENG phone app to connect your wallet to them. Listing an app here is not an endorsement."}
          </Text>
        </View>
      </View>
    </Screen>
  );
}
