import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Search, X } from "lucide-react-native";
import type { ComponentType, ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useTheme } from "./theme";
import { buttonGradient, fonts, radius, space } from "./tokens";

/** Removes the browser focus outline on text inputs (focus is shown by the field border instead). */
export const noOutline = (Platform.OS === "web" ? { outlineStyle: "none" } : {}) as unknown as TextStyle;

/* ───────────── Text ───────────── */

type Variant = "display" | "title" | "heading" | "subheading" | "body" | "bodyStrong" | "caption" | "label" | "mono";

const variantStyle: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.8 },
  title: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  subheading: { fontFamily: fonts.headingMedium, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, monospace" }), fontSize: 13 },
};

export function Text({
  variant = "body",
  tone = "primary",
  style,
  ...props
}: TextProps & { variant?: Variant; tone?: "primary" | "secondary" | "tertiary" | "accent" | "positive" | "negative" | "inverse" }) {
  const { theme } = useTheme();
  const color = {
    primary: theme.text,
    secondary: theme.textSecondary,
    tertiary: theme.textTertiary,
    accent: theme.accent,
    positive: theme.positive,
    negative: theme.negative,
    inverse: "#FFFFFF",
  }[tone];
  return <RNText {...props} style={[variantStyle[variant], { color }, style]} />;
}

/* ───────────── Pressable with feedback ───────────── */

export function Tap({ style, onPress, haptic = true, ...props }: PressableProps & { haptic?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      {...props}
      onPress={(e) => {
        if (haptic && Platform.OS !== "web") void Haptics.selectionAsync();
        onPress?.(e);
      }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        style,
        { opacity: props.disabled ? 0.45 : pressed ? 0.85 : hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    />
  );
}

/* ───────────── Buttons ───────────── */

type ButtonKind = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  label,
  onPress,
  kind = "primary",
  icon: Icon,
  loading,
  disabled,
  style,
  size = "lg",
  accessibilityHint,
}: {
  label: string;
  onPress?: () => void;
  kind?: ButtonKind;
  icon?: ComponentType<{ size?: number; color?: string }>;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: "md" | "lg";
  accessibilityHint?: string;
}) {
  const { theme } = useTheme();
  const h = size === "lg" ? 54 : 42;
  const fg = kind === "primary" ? "#FFFFFF" : kind === "danger" ? theme.negative : theme.text;
  const inner = (
    <View style={{ height: h, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20 }}>
      {loading ? <ActivityIndicator color={fg} /> : Icon ? <Icon size={18} color={fg} /> : null}
      <RNText style={{ fontFamily: fonts.bodySemibold, fontSize: size === "lg" ? 16 : 14, color: fg }}>{label}</RNText>
    </View>
  );
  return (
    <Tap
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[
        { borderRadius: radius.md, overflow: "hidden" },
        kind === "secondary" && { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: "transparent" },
        kind === "ghost" && { backgroundColor: theme.accentSoft },
        kind === "danger" && { borderWidth: 1, borderColor: theme.negative + "66" },
        style,
      ]}
    >
      {kind === "primary" ? (
        <LinearGradient colors={buttonGradient} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}>
          {inner}
        </LinearGradient>
      ) : (
        inner
      )}
    </Tap>
  );
}

export function IconButton({
  icon: Icon,
  onPress,
  label,
  tone = "default",
  size = 40,
  badge,
}: {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  onPress?: () => void;
  label: string;
  tone?: "default" | "accent" | "plain";
  size?: number;
  badge?: number;
}) {
  const { theme } = useTheme();
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tone === "accent" ? theme.accent : tone === "plain" ? "transparent" : theme.surface,
      }}
    >
      <Icon size={size * 0.48} color={tone === "accent" ? "#FFFFFF" : theme.text} strokeWidth={1.8} />
      {badge ? <Counter value={badge} style={{ position: "absolute", top: -2, right: -2 }} /> : null}
    </Tap>
  );
}

/* ───────────── Badges ───────────── */

export function Counter({ value, style }: { value: number; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return (
    <View
      style={[{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" }, style]}
      accessibilityLabel={`${value} unread`}
    >
      <RNText style={{ color: "#FFFFFF", fontFamily: fonts.bodySemibold, fontSize: 11 }}>{value > 99 ? "99+" : value}</RNText>
    </View>
  );
}

export function Pill({ label, tone = "neutral", icon: Icon }: { label: string; tone?: "neutral" | "accent" | "positive" | "warning" | "negative"; icon?: ComponentType<{ size?: number; color?: string }> }) {
  const { theme } = useTheme();
  const color = { neutral: theme.textSecondary, accent: theme.accent, positive: theme.positive, warning: theme.warning, negative: theme.negative }[tone];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full, backgroundColor: color + "1F" }}>
      {Icon ? <Icon size={12} color={color} /> : null}
      <RNText style={{ color, fontFamily: fonts.bodyMedium, fontSize: 12 }}>{label}</RNText>
    </View>
  );
}

/* ───────────── Inputs ───────────── */

export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 46, borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
      <Search size={18} color={theme.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        accessibilityLabel={placeholder}
        style={[{ flex: 1, color: theme.text, fontFamily: fonts.body, fontSize: 15 }, noOutline]}
      />
      {value ? (
        <Tap onPress={() => onChangeText("")} accessibilityLabel="Clear search" haptic={false}>
          <X size={16} color={theme.textTertiary} />
        </Tap>
      ) : null}
    </View>
  );
}

export function Field({
  label,
  error,
  hint,
  ...props
}: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label" tone="secondary">{label}</Text>
      <TextInput
        placeholderTextColor={theme.textTertiary}
        accessibilityLabel={label}
        {...props}
        style={[
          {
            minHeight: 52,
            borderRadius: radius.md,
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: error ? theme.negative : theme.border,
            color: theme.text,
            fontFamily: fonts.body,
            fontSize: 16,
          },
          noOutline,
          props.style,
        ]}
      />
      {error ? <Text variant="caption" tone="negative" accessibilityLiveRegion="polite">{error}</Text> : hint ? <Text variant="caption" tone="tertiary">{hint}</Text> : null}
    </View>
  );
}

/* ───────────── Surfaces ───────────── */

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[{ backgroundColor: theme.card, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border }, padded && { padding: space.lg }, style]}>
      {children}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.md }}>
      <Text variant="heading">{title}</Text>
      {action ? (
        <Tap onPress={onAction} accessibilityRole="button" haptic={false}>
          <Text variant="caption" tone="secondary">{action}</Text>
        </Tap>
      ) : null}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { theme } = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.border, marginLeft: inset }} />;
}

/* ───────────── States ───────────── */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: 24, gap: 12 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.accentSoft, alignItems: "center", justifyContent: "center" }}>
        <Icon size={28} color={theme.accent} strokeWidth={1.6} />
      </View>
      <Text variant="heading" style={{ textAlign: "center" }}>{title}</Text>
      <Text tone="secondary" style={{ textAlign: "center", maxWidth: 340 }}>{body}</Text>
      {action ? <Button label={action.label} onPress={action.onPress} size="md" style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

export function ErrorState({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  const { theme } = useTheme();
  return (
    <View style={{ padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.negative + "55", backgroundColor: theme.negative + "12", gap: 6 }} accessibilityRole="alert">
      <Text variant="bodyStrong" tone="negative">{title}</Text>
      <Text variant="caption" tone="secondary">{body}</Text>
      {onRetry ? (
        <Tap onPress={onRetry} accessibilityRole="button" style={{ marginTop: 6 }}>
          <Text variant="bodyStrong" tone="accent">Try again</Text>
        </Tap>
      ) : null}
    </View>
  );
}

export function Skeleton({ width, height, radius: r = 8, style }: { width: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return <View style={[{ width, height, borderRadius: r, backgroundColor: theme.surface }, style]} accessibilityLabel="Loading" />;
}

/** Marks sample content until the live integration ships (spec: "clearly label demo data"). */
export function PreviewBanner({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: radius.md, backgroundColor: theme.warning + "14", borderWidth: 1, borderColor: theme.warning + "40" }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.warning, marginTop: 7 }} />
      <Text variant="caption" style={{ color: theme.warning, flex: 1 }}>{text}</Text>
    </View>
  );
}
