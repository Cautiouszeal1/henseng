import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from "expo-router/ui";
import { Compass, MessageCircle, UserRound, Users, Wallet, type LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "../../profile/profile-context";
import { Avatar } from "../../ui/avatar";
import { Wordmark } from "../../ui/logo";
import { Counter, Text } from "../../ui/primitives";
import { useLayout, useTheme } from "../../ui/theme";
import { radius } from "../../ui/tokens";
import { PREVIEW_CHATS } from "../../data/preview";

const TABS: { name: string; href: "/chats" | "/communities" | "/wallet" | "/explore" | "/profile"; label: string; icon: LucideIcon }[] = [
  { name: "chats", href: "/chats", label: "Chats", icon: MessageCircle },
  { name: "communities", href: "/communities", label: "Communities", icon: Users },
  { name: "wallet", href: "/wallet", label: "Wallet", icon: Wallet },
  { name: "explore", href: "/explore", label: "Explore", icon: Compass },
  { name: "profile", href: "/profile", label: "Profile", icon: UserRound },
];

const unreadChats = PREVIEW_CHATS.filter((c) => c.unread > 0).length;

type ButtonProps = TabTriggerSlotProps & { icon: LucideIcon; label: string; variant: "bar" | "side"; badge?: number };

function TabButton({ icon: Icon, label, isFocused, variant, badge, ref: _ref, ...props }: ButtonProps) {
  void _ref;
  const { theme } = useTheme();
  const color = isFocused ? theme.accent : theme.textSecondary;
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
          backgroundColor: isFocused ? theme.accentSoft : hovered ? theme.surface : "transparent",
        })}
      >
        <Icon size={22} color={color} strokeWidth={isFocused ? 2.2 : 1.8} />
        <Text variant="bodyStrong" style={{ color: isFocused ? theme.text : theme.textSecondary, flex: 1 }}>{label}</Text>
        {badge ? <Counter value={badge} /> : null}
      </Pressable>
    );
  }
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: isFocused }} accessibilityLabel={label} style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: 8 }}>
      <View>
        <View style={{ paddingHorizontal: 16, paddingVertical: 4, borderRadius: radius.full, backgroundColor: isFocused ? theme.accentSoft : "transparent" }}>
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
          <View style={{ width: isDesktop ? 260 : 220, borderRightWidth: 1, borderRightColor: theme.border, backgroundColor: theme.surface, paddingTop: insets.top + 24, paddingHorizontal: 14, paddingBottom: 20 }}>
            <View style={{ paddingHorizontal: 10, marginBottom: 28 }}>
              <Wordmark size={30} />
            </View>
            <View style={{ gap: 4 }} accessibilityRole="tablist">{triggers("side")}</View>
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.md, backgroundColor: theme.card }}>
              <Avatar name={profile.displayName || "You"} size={38} presence={profile.showOnline ? "online" : undefined} gradientIndex={profile.avatarIndex} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>{profile.displayName || "Your profile"}</Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>{profile.username ? `@${profile.username}` : "Set a username"}</Text>
              </View>
            </View>
          </View>
        )}
        <View style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
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
              borderTopWidth: 1,
              borderTopColor: theme.border,
            }}
          >
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
