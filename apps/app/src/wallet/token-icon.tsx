import { View } from "react-native";
import { Text } from "../ui/primitives";
import { useTheme } from "../ui/theme";
import type { Network } from "./networks";

const COLORS: Record<string, string> = { ETH: "#627EEA", USDC: "#2775CA", USDT: "#26A17B", DAI: "#F5AC37", WETH: "#EC4A8A", ARB: "#28A0F0" };
const GLYPHS: Record<string, string> = { ETH: "Ξ", USDC: "$", USDT: "₮", DAI: "◈", WETH: "W", ARB: "A" };

/** Token badge with a small network dot, drawn locally (no remote logo requests). */
export function TokenIcon({ symbol, network, size = 42 }: { symbol: string; network?: Network; size?: number }) {
  const { theme } = useTheme();
  const dot = Math.round(size * 0.43);
  return (
    <View accessibilityLabel={network ? `${symbol} on ${network.name}` : symbol}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: COLORS[symbol] ?? theme.accent, alignItems: "center", justifyContent: "center" }}>
        <Text variant="bodyStrong" tone="inverse" style={{ fontSize: size * 0.42 }}>{GLYPHS[symbol] ?? symbol.slice(0, 1)}</Text>
      </View>
      {network ? <View style={{ position: "absolute", right: -3, bottom: -3, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: network.color, borderWidth: 2, borderColor: theme.card }} /> : null}
    </View>
  );
}
