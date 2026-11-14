import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { View } from "react-native";
import { Text } from "./primitives";

/**
 * HENSENG mark — original identity. Two pillars joined by a rising bridge:
 * the "H" of HENSENG, its crossbar rising slightly as value moves between networks.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="HENSENG">
      <Defs>
        <LinearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8957FF" />
          <Stop offset="0.6" stopColor="#397BFF" />
          <Stop offset="1" stopColor="#FF9A4D" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="64" height="64" rx="18" fill="url(#hg)" />
      <Rect x="15" y="15" width="9" height="34" rx="4.5" fill="#FFFFFF" />
      <Rect x="40" y="15" width="9" height="34" rx="4.5" fill="#FFFFFF" />
      <Path d="M22 35 C 29 35, 34 29, 42 29" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <LogoMark size={size} />
      <Text variant="heading" style={{ fontSize: size * 0.62, letterSpacing: 2 }}>HENSENG</Text>
    </View>
  );
}
