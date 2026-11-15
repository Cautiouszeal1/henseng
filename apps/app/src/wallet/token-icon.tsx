import { findToken, type TokenInfo } from "@henseng/wallet";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import { Text } from "../ui/primitives";
import { useTheme } from "../ui/theme";
import { NETWORK_LOGO_KEY, NETWORK_LOGOS, TOKEN_LOGOS } from "./logos";
import type { NetworkInfo } from "./networks";

/**
 * Token icon with a small network badge. Official logos are bundled in the app and shown
 * only when this exact token (network + contract) is on HENSENG's verified list. A token
 * someone created with a famous name ("USDC" at another address) gets a neutral icon instead,
 * so a fake can't borrow the real logo.
 */
export function TokenIcon({ token, network, size = 42 }: { token: Pick<TokenInfo, "chainId" | "address" | "symbol">; network?: NetworkInfo; size?: number }) {
  const { theme } = useTheme();
  const verified = findToken(token.chainId, token.address);
  const logo = verified && verified.symbol === token.symbol ? TOKEN_LOGOS[token.symbol] : undefined;
  const netLogo = network ? NETWORK_LOGOS[NETWORK_LOGO_KEY[network.id] ?? ""] : undefined;
  const badge = Math.round(size * 0.44);
  return (
    <View accessibilityRole="image" accessibilityLabel={network ? `${token.symbol} on ${network.name}` : token.symbol}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: logo ? "transparent" : theme.surface, borderWidth: logo ? 0 : 1, borderColor: theme.borderStrong }}>
        {logo ? (
          <SvgXml xml={logo} width={size} height={size} />
        ) : (
          <Text variant="bodyStrong" tone="secondary" style={{ fontSize: size * 0.38 }}>{token.symbol.slice(0, 1).toUpperCase()}</Text>
        )}
      </View>
      {network ? (
        <View style={{ position: "absolute", right: -3, bottom: -3, width: badge, height: badge, borderRadius: badge / 2, overflow: "hidden", borderWidth: 2, borderColor: theme.card, backgroundColor: network.color }}>
          {netLogo ? <SvgXml xml={netLogo} width={badge - 4} height={badge - 4} /> : null}
        </View>
      ) : null}
    </View>
  );
}
