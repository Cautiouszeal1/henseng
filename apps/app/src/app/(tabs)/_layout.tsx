import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from "expo-router/ui";
import { Compass, MessageCircle, UserRound, Users, Wallet, type LucideIcon } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "../../profile/profile-context";
import { ScreenGlow } from "../../ui/art";
import { Avatar } from "../../ui/avatar";
import { Wordmark } from "../../ui/logo";
import { Counter, Text } from "../../ui/primitives";
import { useLayout, useTheme } from "../../ui/theme";
import { radius } from "../../ui/tokens";
import { PREVIEW_CHATS } from "../../data/preview";
import { useMessaging } from "../../messaging/messaging-context";

const TABS: { name: string; href: "/chats" | "/communities" | "/wallet" | "/explore" | "/profile"; label: string; icon: LucideIcon }[] = [
  { name: "chats", href: "/chats", label: "Chats", icon: MessageCircle },
  { name: "communities", href: "/communities", label: "Communities", icon: Users },
  { name: "wallet", href: "/wallet", label: "Wallet", icon: Wallet },
  { name: "explore", href: "/explore", label: "Explore", icon: Compass },
  { name: "profile", href: "/profile", label: "Profile", icon: UserRound },
];

const previewUnread = PREVIEW_CHATS.filter((c) => c.unread > 0).length;

type ButtonProps = TabTriggerSlotProps & { icon: LucideIcon; label: string; variant: "bar" | "side"; badge?: number };

function TabButton({ icon: Icon, label, isFocused, variant, badge, ref: _ref, ...props }: ButtonProps) {
  void _ref;
  const { theme } = useTheme();
  const dark = theme.mode === "dark";
  const color = isFocused ? (dark ? "#C9B5FF" : theme.accent) : theme.textSecondary;
  if (variant === "side") {
    return (
      <Pressable
        {...props}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={label}
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: radius.md,
          backgroundColor: isFocused ? "transparent" : hovered ? theme.surface : "transparent",
          overflow: "hidden",
        })}
      >
        {isFocused ? (
          <>
            <LinearGradient colors={dark ? ["rgba(137,87,255,0.26)", "rgba(57,123,255,0.06)"] : ["rgba(137,87,255,0.14)", "rgba(57,123,255,0.03)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
            <LinearGradient colors={["#8957FF", "#397BFF"]} style={{ position: "absolute", left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 }} />
          </>
        ) : null}
        <Icon size={22} color={color} strokeWidth={isFocused ? 2.2 : 1.8} />
        <Text variant="bodyStrong" style={{ color: isFocused ? theme.text : theme.textSecondary, flex: 1 }}>{label}</Text>
        {badge ? <Counter value={badge} /> : null}
      </Pressable>
    );
  }
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: isFocused }} accessibilityLabel={label} style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: 8 }}>
      <View>
        <View style={{ paddingHorizontal: 16, paddingVertical: 4, borderRadius: radius.full, overflow: "hidden" }}>
          {isFocused ? (
            <LinearGradient colors={dark ? ["rgba(137,87,255,0.38)", "rgba(57,123,255,0.22)"] : ["rgba(137,87,255,0.16)", "rgba(57,123,255,0.1)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
          ) : null}
          <Icon size={23} color={color} strokeWidth={isFocused ? 2.2 : 1.8} />
        </View>
        {badge ? <Counter value={badge} style={{ position: "absolute", top: -4, right: 4, minWidth: 18, height: 18 }} /> : null}
      </View>
      <Text variant="label" style={{ color, fontSize: 11 }}>{label}</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { theme } = useTheme();
  const { isWide, isDesktop } = useLayout();
  const messaging = useMessaging();
  // Live builds count real encrypted chats; preview builds count the labelled sample chats.
  const unreadChats = messaging.status === "off" ? previewUnread : messaging.unreadChats;
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();

  const triggers = (variant: "bar" | "side") =>
    TABS.map((t) => (
      <TabTrigger key={t.name} name={t.name} asChild>
        <TabButton icon={t.icon} label={t.label} variant={variant} badge={t.name === "chats" ? unreadChats : undefined} />
      </TabTrigger>
    ));

  return (
    <Tabs style={{ flex: 1 }}>
      <View style={{ flex: 1, minHeight: 0, flexDirection: isWide ? "row" : "column", backgroundColor: theme.bg }}>
        {isWide && (
          <View style={{ width: isDesktop ? 260 : 220, borderRightWidth: 1, borderRightColor: theme.border, backgroundColor: theme.surface, paddingTop: insets.top + 24, paddingHorizontal: 14, paddingBottom: 20, overflow: "hidden" }}>
            {theme.mode === "dark" ? (
              <>
                <LinearGradient colors={["#1A1630", "#141320", "#121119"]} locations={[0, 0.45, 1]} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
                <ScreenGlow intensity={0.9} />
              </>
            ) : null}
            <View style={{ paddingHorizontal: 10, marginBottom: 28 }}>
              <Wordmark size={30} />
            </View>
            <View style={{ gap: 4 }} accessibilityRole="tablist">{triggers("side")}</View>
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.md, backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.04)" : theme.card, borderWidth: 1, borderColor: theme.border, borderTopColor: theme.mode === "dark" ? "rgba(255,255,255,0.1)" : theme.border }}>
              <Avatar name={profile.displayName || "You"} size={38} presence={profile.showOnline ? "online" : undefined} gradientIndex={profile.avatarIndex} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>{profile.displayName || "Your profile"}</Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>{profile.username ? `@${profile.username}` : "Set a username"}</Text>
              </View>
            </View>
          </View>
        )}
        <View style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          {theme.mode === "dark" ? <ScreenGlow /> : null}
          {/* Pin the slot to the space above the tab bar (the default container grows with its content). */}
          <TabSlot style={{ flex: 1, flexBasis: 0, minHeight: 0, overflow: "hidden" }} />
        </View>
        {!isWide && (
          <View
            accessibilityRole="tablist"
            style={{
              flexDirection: "row",
              paddingBottom: Math.max(insets.bottom, 8),
              paddingTop: 6,
              paddingHorizontal: 6,
              backgroundColor: theme.tabBar,
            }}
          >
            <LinearGradient colors={["rgba(137,87,255,0)", "rgba(137,87,255,0.55)", "rgba(57,123,255,0.55)", "rgba(255,154,77,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 1 }} />
            {triggers("bar")}
          </View>
        )}
      </View>
      <TabList style={{ display: "none" }}>
        {TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} />
        ))}
      </TabList>
    </Tabs>
  );
}
