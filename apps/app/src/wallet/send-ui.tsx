import { AlertTriangle, Info } from "lucide-react-native";
import { View } from "react-native";
import { Text } from "../ui/primitives";
import { useTheme } from "../ui/theme";
import { radius } from "../ui/tokens";

/** "0x1234 5678 …" groups so the whole address is easy to check against the source. */
export function AddressBlock({ address }: { address: string }) {
  const { theme } = useTheme();
  const evm = address.startsWith("0x");
  const body = evm ? address.slice(2) : address;
  const groups = body.match(/.{1,4}/g) ?? [];
  const prefix = evm ? "0x" : "";
  return (
    <Text variant="mono" selectable accessibilityLabel={address} style={{ lineHeight: 22 }}>
      <Text variant="mono" style={{ color: theme.accent }}>{prefix}{groups[0]}</Text>
      {" "}{groups.slice(1, -1).join(" ")}{" "}
      <Text variant="mono" style={{ color: theme.accent }}>{groups.at(-1)}</Text>
    </Text>
  );
}

export function Notice({ tone, children }: { tone: "warning" | "info" | "negative"; children: string }) {
  const { theme } = useTheme();
  const color = tone === "warning" ? theme.warning : tone === "negative" ? theme.negative : theme.accent;
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <View style={{ flexDirection: "row", gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: color + "14", borderWidth: 1, borderColor: color + "40" }}>
      <Icon size={16} color={color} style={{ marginTop: 2 }} />
      <Text variant="caption" style={{ color, flex: 1 }}>{children}</Text>
    </View>
  );
}

