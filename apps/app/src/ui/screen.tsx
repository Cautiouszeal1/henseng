import type { ReactNode } from "react";
import { ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./primitives";
import { useLayout, useTheme } from "./theme";
import { space } from "./tokens";

/**
 * Standard tab screen: safe-area padding, a readable max width on large
 * monitors, and room for the floating tab bar on phones.
 */
export function Screen({
  title,
  right,
  children,
  scroll = true,
  maxWidth = 760,
  contentStyle,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const { isWide } = useLayout();
  const insets = useSafeAreaInsets();
  void insets.bottom;
  const header = title ? (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.lg, minHeight: 44 }}>
      <Text variant="title" accessibilityRole="header">{title}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>{right}</View>
    </View>
  ) : null;
  const pad = {
    paddingTop: (isWide ? space.xxl : insets.top + space.md),
    paddingHorizontal: isWide ? space.xxl : space.lg,
    paddingBottom: isWide ? space.xxl : space.xl,
    width: "100%" as const,
    maxWidth,
    alignSelf: "center" as const,
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[pad, contentStyle]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>
          {header}
          {children}
        </View>
      )}
    </View>
  );
}
