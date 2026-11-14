import { LinearGradient } from "expo-linear-gradient";
import { Text as RNText, View } from "react-native";
import { useTheme } from "./theme";
import { avatarGradients, fonts } from "./tokens";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string): string {
  const parts = name.replace(/^0x/i, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export type Presence = "online" | "away" | "offline";

/**
 * Round avatar used everywhere a person or community appears. Until profile
 * photos are uploaded, each identity gets a stable gradient + initials, so
 * the same person always looks the same across the app.
 */
export function Avatar({
  name,
  seed,
  size = 48,
  presence,
  ring = false,
  square = false,
  gradientIndex,
}: {
  name: string;
  seed?: string;
  size?: number;
  presence?: Presence;
  ring?: boolean;
  square?: boolean;
  gradientIndex?: number;
}) {
  const { theme } = useTheme();
  const g = avatarGradients[(gradientIndex ?? hash(seed ?? name)) % avatarGradients.length]!;
  const r = square ? size * 0.3 : size / 2;
  const dot = Math.max(10, Math.round(size * 0.26));
  const body = (
    <LinearGradient
      colors={g}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: r, alignItems: "center", justifyContent: "center" }}
    >
      <RNText style={{ color: "#FFFFFF", fontFamily: fonts.heading, fontSize: size * 0.36, letterSpacing: 0.3 }}>{initials(name)}</RNText>
    </LinearGradient>
  );
  return (
    <View accessibilityLabel={`${name}${presence ? `, ${presence}` : ""}`} accessibilityRole="image">
      {ring ? (
        <LinearGradient colors={["#8957FF", "#397BFF", "#FF9A4D"]} style={{ padding: 2.5, borderRadius: r + 4 }}>
          <View style={{ padding: 2, borderRadius: r + 2, backgroundColor: theme.bg }}>{body}</View>
        </LinearGradient>
      ) : (
        body
      )}
      {presence && presence !== "offline" ? (
        <View
          style={{
            position: "absolute",
            right: ring ? 2 : 0,
            bottom: ring ? 2 : 0,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: presence === "online" ? theme.positive : theme.warning,
            borderWidth: 2.5,
            borderColor: theme.bg,
          }}
        />
      ) : null}
    </View>
  );
}
