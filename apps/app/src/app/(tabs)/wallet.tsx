import { formatTokenAmount, shortAddress } from "@henseng/wallet";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  RefreshCw,
  Repeat,
  ScanLine,
  Lock,
} from "lucide-react-native";
import { useState } from "react";
import { Switch, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Sheet, useToast } from "../../ui/overlays";
import { Button, Card, EmptyState, IconButton, Pill, SectionHeader, Skeleton, Tap, Text } from "../../ui/primitives";
import { Screen } from "../../ui/screen";
import { useLayout, useTheme } from "../../ui/theme";
import { radius } from "../../ui/tokens";
import { NETWORKS } from "../../wallet/networks";
import { useNativeBalances } from "../../wallet/use-balances";
import { useWallet } from "../../wallet/wallet-context";

type Action = "receive" | "send" | "swap" | "bridge" | null;

function ActionButton({ icon: Icon, label, onPress }: { icon: typeof ArrowUpRight; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Tap onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: "center", gap: 8, flex: 1 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accent + "40", alignItems: "center", justifyContent: "center" }}>
        <Icon size={22} color={theme.mode === "dark" ? "#C4ADFF" : theme.accent} />
      </View>
      <Text variant="label" tone="secondary">{label}</Text>
    </Tap>
  );
}

export default function WalletScreen() {
  const { theme } = useTheme();
  const { isDesktop } = useLayout();
  const { address, lock } = useWallet();
  const toast = useToast();
  const [hidden, setHidden] = useState(false);
  const [testnets, setTestnets] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const { rows, refresh, updatedAt } = useNativeBalances(address, testnets);

  const mainnetTotal = rows.reduce((sum, r) => (r.status === "ok" && !r.network.testnet ? sum + r.wei : sum), 0n);
  const loading = rows.some((r) => r.status === "loading");
  const failed = rows.filter((r) => r.status === "error").length;
  const mainnetRows = rows.filter((r) => !r.network.testnet);
  // Never show a total unless at least one mainnet balance was actually read.
  const totalKnown = mainnetRows.some((r) => r.status === "ok");
  const mask = (s: string) => (hidden ? "••••••" : s);

  const copy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    toast("Address copied", "success");
  };

  const balanceCard = (
    <View style={{ borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: theme.border }}>
      <LinearGradient colors={["#2A1F5C", "#1E2A6B", "#1C1B27"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 22, gap: 18 }}>
        <View style={{ position: "absolute", right: -50, top: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(137,87,255,0.25)" }} />
        <View style={{ position: "absolute", right: 30, bottom: -80, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,154,77,0.12)" }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text variant="caption" style={{ color: "#C9C7D6" }}>Total balance · mainnets</Text>
          <Tap onPress={() => setHidden((v) => !v)} accessibilityLabel={hidden ? "Show balance" : "Hide balance"} haptic={false}>
            {hidden ? <EyeOff size={16} color="#C9C7D6" /> : <Eye size={16} color="#C9C7D6" />}
          </Tap>
        </View>
        {loading && !updatedAt ? (
          <Skeleton width={200} height={40} style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
        ) : (
          <Text variant="display" tone="inverse" accessibilityLabel={hidden ? "Balance hidden" : totalKnown ? `${formatTokenAmount(mainnetTotal, 18)} ETH` : "Balance unavailable"}>
            {totalKnown ? mask(`${formatTokenAmount(mainnetTotal, 18)} ETH`) : "Unavailable"}
          </Text>
        )}
        <Text variant="caption" style={{ color: "#B8B6C6" }}>
          {!totalKnown && !loading ? "No network could be reached. Check your connection and tap Refresh." : failed ? `${failed} network${failed > 1 ? "s" : ""} couldn't be reached, so this total is partial. Tap Refresh to try again.` : "USD value and 24h change appear once price feeds connect in Phase 3."}
        </Text>
        <Tap onPress={() => void copy()} accessibilityLabel={`Copy address ${address}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.1)" }}>
          <Text variant="mono" style={{ color: "#FFFFFF" }}>{address ? shortAddress(address) : "—"}</Text>
          <Copy size={14} color="#FFFFFF" />
        </Tap>
      </LinearGradient>
    </View>
  );

  const actions = (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <ActionButton icon={ArrowDownToLine} label="Receive" onPress={() => setAction("receive")} />
      <ActionButton icon={ArrowUpRight} label="Send" onPress={() => setAction("send")} />
      <ActionButton icon={Repeat} label="Swap" onPress={() => setAction("swap")} />
      <ActionButton icon={ArrowLeftRight} label="Bridge" onPress={() => setAction("bridge")} />
    </View>
  );

  const assets = (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Text variant="heading">Your assets</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text variant="caption" tone="secondary">Testnets</Text>
          <Switch value={testnets} onValueChange={setTestnets} trackColor={{ true: theme.accent, false: theme.surface }} thumbColor="#FFFFFF" accessibilityLabel="Show testnets" />
        </View>
      </View>
      <Card padded={false}>
        {rows.map((r, i) => (
          <View key={r.network.chain.id} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
            <View>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#627EEA", alignItems: "center", justifyContent: "center" }}>
                <Text variant="bodyStrong" tone="inverse">Ξ</Text>
              </View>
              <View style={{ position: "absolute", right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, backgroundColor: r.network.color, borderWidth: 2, borderColor: theme.card }} accessibilityLabel={r.network.name} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="subheading">Ether</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text variant="caption" tone="secondary">{r.network.name}</Text>
                {r.network.testnet ? <Pill label="Testnet" tone="warning" /> : null}
              </View>
            </View>
            {r.status === "loading" ? (
              <Skeleton width={80} height={18} />
            ) : r.status === "error" ? (
              <Text variant="caption" tone="negative">Unavailable</Text>
            ) : (
              <Text variant="bodyStrong" style={{ fontVariant: ["tabular-nums"] }}>{mask(formatTokenAmount(r.wei, 18))} ETH</Text>
            )}
          </View>
        ))}
      </Card>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <Text variant="caption" tone="tertiary">{updatedAt ? `Live from each network · ${updatedAt.toLocaleTimeString()}` : "Reading balances from each network…"}</Text>
        <Tap onPress={refresh} accessibilityRole="button" accessibilityLabel="Refresh balances" style={{ flexDirection: "row", gap: 6, alignItems: "center", padding: 4 }}>
          <RefreshCw size={14} color={theme.accent} />
          <Text variant="caption" tone="accent">Refresh</Text>
        </Tap>
      </View>
      <Text variant="caption" tone="tertiary" style={{ marginTop: 6 }}>Tokens like USDC, NFTs and Solana appear in Phase 3.</Text>
    </View>
  );

  const history = (
    <View>
      <SectionHeader title="Transaction history" />
      <Card>
        <EmptyState
          icon={History}
          title="No HENSENG transactions yet"
          body="Sends, swaps and bridges you make in HENSENG will be listed here with their live status."
          action={
            address
              ? { label: "View address on Etherscan", onPress: () => void WebBrowser.openBrowserAsync(`https://etherscan.io/address/${address}`) }
              : undefined
          }
        />
      </Card>
    </View>
  );

  return (
    <Screen
      title="Wallet"
      maxWidth={isDesktop ? 1080 : 760}
      right={
        <>
          <IconButton icon={ScanLine} label="Scan QR code" onPress={() => toast("QR scanning arrives with Send in Phase 3.")} />
          <IconButton icon={Bell} label="Wallet notifications" onPress={() => toast("Transaction alerts arrive in Phase 3.")} />
          <IconButton icon={Lock} label="Lock wallet" onPress={lock} />
        </>
      }
    >
      {isDesktop ? (
        <View style={{ flexDirection: "row", gap: 28 }}>
          <View style={{ flex: 1, gap: 24 }}>
            {balanceCard}
            {actions}
            {history}
          </View>
          <View style={{ flex: 1 }}>{assets}</View>
        </View>
      ) : (
        <View style={{ gap: 24 }}>
          {balanceCard}
          {actions}
          {assets}
          {history}
        </View>
      )}

      <Sheet visible={action === "receive"} onClose={() => setAction(null)} title="Receive">
        <Text tone="secondary">Send only Ethereum-network assets (Ethereum, Base, Arbitrum and their testnets) to this address.</Text>
        <View style={{ alignSelf: "center", padding: 16, borderRadius: radius.lg, backgroundColor: "#FFFFFF" }}>
          {address ? <QRCode value={address} size={200} color="#101014" backgroundColor="#FFFFFF" /> : null}
        </View>
        <Card style={{ gap: 6 }}>
          <Text variant="label" tone="secondary">Your address</Text>
          <Text variant="mono" selectable>{address}</Text>
        </Card>
        <Button label="Copy address" icon={Copy} onPress={() => void copy()} />
        <Button label="View on explorer" icon={ExternalLink} kind="secondary" onPress={() => address && void WebBrowser.openBrowserAsync(`${NETWORKS[0]!.explorer}/address/${address}`)} />
      </Sheet>

      <Sheet visible={action === "send" || action === "swap" || action === "bridge"} onClose={() => setAction(null)} title={action === "send" ? "Send" : action === "swap" ? "Swap" : "Bridge"}>
        <EmptyState
          icon={action === "send" ? ArrowUpRight : action === "swap" ? Repeat : ArrowLeftRight}
          title={action === "send" ? "Sending arrives in Phase 3" : action === "swap" ? "Swapping arrives in Phase 4" : "Bridging arrives in Phase 4"}
          body={
            action === "send"
              ? "Send tokens with address checks, a fee preview and a confirmation screen. Signed on this device."
              : action === "swap"
                ? "Real quotes from 0x and other aggregators, with every fee shown before you sign."
                : "Move assets between networks through vetted bridges, tracked until they arrive."
          }
        />
        <Button label="Got it" kind="secondary" onPress={() => setAction(null)} />
      </Sheet>
    </Screen>
  );
}
