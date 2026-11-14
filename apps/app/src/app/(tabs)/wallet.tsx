import { formatTokenAmount, shortAddress } from "@henseng/wallet";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpRight, Bell, Copy, ExternalLink, Eye, EyeOff, History, Lock, RefreshCw, Repeat, ScanLine } from "lucide-react-native";
import { useState } from "react";
import { Switch, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Sheet, useToast } from "../../ui/overlays";
import { Button, Card, EmptyState, IconButton, Pill, SectionHeader, Skeleton, Tap, Text } from "../../ui/primitives";
import { Screen } from "../../ui/screen";
import { useLayout, useTheme } from "../../ui/theme";
import { radius } from "../../ui/tokens";
import { useActivity } from "../../wallet/activity";
import { explorerAddress, explorerTx, networkFor } from "../../wallet/networks";
import { TokenIcon } from "../../wallet/token-icon";
import { formatUsd, usePortfolio } from "../../wallet/use-portfolio";
import { useWallet } from "../../wallet/wallet-context";

type Action = "receive" | "swap" | "bridge" | null;

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

function timeAgo(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function WalletScreen() {
  const { theme } = useTheme();
  const { isDesktop } = useLayout();
  const { address, lock } = useWallet();
  const toast = useToast();
  const p = usePortfolio();
  const { items } = useActivity();
  const [hidden, setHidden] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const mask = (s: string) => (hidden ? "••••••" : s);

  const copy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    toast("Address copied", "success");
  };

  const firstLoad = p.loading && !p.updatedAt;
  const mainnetsDown = p.statuses.filter((s) => !s.network.testnet).every((s) => s.status === "error");
  const totalNote = (() => {
    if (firstLoad) return "Reading balances from each network…";
    if (mainnetsDown) return "No network could be reached. Check your connection and tap Refresh.";
    if (p.prices.status === "off") return "USD values need the HENSENG server, which this build isn't connected to.";
    if (p.prices.status === "error") return "Prices couldn't be loaded, so there's no USD total right now. Your balances below are live.";
    if (p.prices.status === "loading") return "Loading prices…";
    if (p.failedNetworks.some((n) => !n.testnet)) return `${p.failedNetworks.filter((n) => !n.testnet).map((n) => n.name).join(" and ")} couldn't be reached, so this total is partial.`;
    return "Ethereum, Base and Arbitrum. Testnet tokens have no value and aren't counted.";
  })();

  const balanceCard = (
    <View style={{ borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: theme.border }}>
      <LinearGradient colors={["#2A1F5C", "#1E2A6B", "#1C1B27"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 22, gap: 16 }}>
        <View style={{ position: "absolute", right: -50, top: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(137,87,255,0.25)" }} />
        <View style={{ position: "absolute", right: 30, bottom: -80, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,154,77,0.12)" }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text variant="caption" style={{ color: "#C9C7D6" }}>Total balance</Text>
          <Tap onPress={() => setHidden((v) => !v)} accessibilityLabel={hidden ? "Show balance" : "Hide balance"} haptic={false}>
            {hidden ? <EyeOff size={16} color="#C9C7D6" /> : <Eye size={16} color="#C9C7D6" />}
          </Tap>
        </View>
        {firstLoad ? (
          <Skeleton width={200} height={40} style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <Text variant="display" tone="inverse" accessibilityLabel={hidden ? "Balance hidden" : p.totalUsd !== null ? formatUsd(p.totalUsd) : "Total unavailable"}>
              {p.totalUsd !== null ? mask(formatUsd(p.totalUsd)) : "—"}
            </Text>
            {p.totalUsd !== null && p.change24h !== null && !hidden ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: p.change24h >= 0 ? "rgba(52,211,153,0.18)" : "rgba(248,113,113,0.18)", marginBottom: 8 }}>
                <Text variant="label" style={{ color: p.change24h >= 0 ? "#6EE7B7" : "#FCA5A5" }}>{`${p.change24h >= 0 ? "+" : ""}${p.change24h.toFixed(2)}% · 24h`}</Text>
              </View>
            ) : null}
          </View>
        )}
        <Text variant="caption" style={{ color: "#B8B6C6" }}>{totalNote}</Text>
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
      <ActionButton icon={ArrowUpRight} label="Send" onPress={() => router.push("/send")} />
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
          <Switch value={p.includeTestnets} onValueChange={p.setIncludeTestnets} trackColor={{ true: theme.accent, false: theme.surface }} thumbColor="#FFFFFF" accessibilityLabel="Show testnets" />
        </View>
      </View>
      <Card padded={false}>
        {firstLoad
          ? [0, 1, 2].map((i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
                <Skeleton width={42} height={42} radius={21} />
                <View style={{ flex: 1, gap: 6 }}><Skeleton width="40%" height={14} /><Skeleton width="25%" height={12} /></View>
                <Skeleton width={70} height={16} />
              </View>
            ))
          : p.holdings.map((h, i) => {
              const price = p.priceOf(h.token);
              return (
                <Tap key={h.key} onPress={() => router.push({ pathname: "/send", params: { chainId: String(h.token.chainId), token: h.token.address ?? "native" } })} accessibilityRole="button" accessibilityLabel={`${h.token.name} on ${h.network.name}: ${formatTokenAmount(h.balance, h.token.decimals)} ${h.token.symbol}. Send`} haptic={false} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
                  <TokenIcon symbol={h.token.symbol} network={h.network} />
                  <View style={{ flex: 1 }}>
                    <Text variant="subheading">{h.token.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text variant="caption" tone="secondary">{h.network.name}{price && !h.network.testnet ? ` · ${formatUsd(price.usd)}` : ""}</Text>
                      {h.network.testnet ? <Pill label="Testnet" tone="warning" /> : null}
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text variant="bodyStrong" style={{ fontVariant: ["tabular-nums"] }}>{mask(formatTokenAmount(h.balance, h.token.decimals))} {h.token.symbol}</Text>
                    {h.usd !== undefined ? <Text variant="caption" tone="secondary">{mask(formatUsd(h.usd))}</Text> : null}
                  </View>
                </Tap>
              );
            })}
        {p.failedNetworks.map((n) => (
          <View key={n.chain.id} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: n.color, marginHorizontal: 16 }} />
            <Text variant="caption" tone="negative" style={{ flex: 1 }}>{n.name} couldn't be reached</Text>
          </View>
        ))}
      </Card>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>{p.updatedAt ? `Read live from each network · ${p.updatedAt.toLocaleTimeString()}` : "Reading balances…"}</Text>
        <Tap onPress={p.refresh} accessibilityRole="button" accessibilityLabel="Refresh balances" style={{ flexDirection: "row", gap: 6, alignItems: "center", padding: 4 }}>
          <RefreshCw size={14} color={theme.accent} />
          <Text variant="caption" tone="accent">Refresh</Text>
        </Tap>
      </View>
      <Text variant="caption" tone="tertiary" style={{ marginTop: 6 }}>Shows ETH, USDC, USDT, DAI, WETH and ARB. Other tokens, NFTs and Solana arrive in Phase 3b.</Text>
    </View>
  );

  const history = (
    <View>
      <SectionHeader title="Activity" />
      <Card padded={!items.length}>
        {items.length ? (
          items.slice(0, 20).map((it, i) => {
            const net = networkFor(it.chainId);
            return (
              <Tap key={it.hash} onPress={() => void WebBrowser.openBrowserAsync(explorerTx(it.chainId, it.hash))} accessibilityRole="link" accessibilityLabel={`Sent ${formatTokenAmount(BigInt(it.amount), it.decimals)} ${it.symbol} on ${net?.name}, ${it.status}. Open in explorer`} haptic={false} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" }}>
                  <ArrowUpRight size={18} color={theme.text} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="subheading">Sent {it.symbol}</Text>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>To {it.toLabel ?? shortAddress(it.to)} · {net?.name} · {timeAgo(it.createdAt)}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text variant="bodyStrong">−{mask(formatTokenAmount(BigInt(it.amount), it.decimals))}</Text>
                  <Pill label={it.status === "pending" ? "Pending" : it.status === "confirmed" ? "Confirmed" : "Failed"} tone={it.status === "pending" ? "warning" : it.status === "confirmed" ? "positive" : "negative"} />
                </View>
              </Tap>
            );
          })
        ) : (
          <EmptyState
            icon={History}
            title="No HENSENG transactions yet"
            body="Sends you make in HENSENG are listed here with their live status. Incoming transfers show in your balances."
            action={address ? { label: "View address on Etherscan", onPress: () => void WebBrowser.openBrowserAsync(explorerAddress(1, address)) } : undefined}
          />
        )}
      </Card>
      {items.length ? <Text variant="caption" tone="tertiary" style={{ marginTop: 8 }}>Transactions sent from HENSENG on this device. Tap one to open it in the explorer.</Text> : null}
    </View>
  );

  return (
    <Screen
      title="Wallet"
      maxWidth={isDesktop ? 1080 : 760}
      right={
        <>
          <IconButton icon={ScanLine} label="Scan QR code" onPress={() => router.push("/scan")} />
          <IconButton icon={Bell} label="Notifications" onPress={() => router.push("/notifications")} />
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
        <Text tone="secondary">This address works on Ethereum, Base, Arbitrum and their testnets. Only send assets on those networks to it.</Text>
        <View style={{ alignSelf: "center", padding: 16, borderRadius: radius.lg, backgroundColor: "#FFFFFF" }}>
          {address ? <QRCode value={address} size={200} color="#101014" backgroundColor="#FFFFFF" /> : null}
        </View>
        <Card style={{ gap: 6 }}>
          <Text variant="label" tone="secondary">Your address</Text>
          <Text variant="mono" selectable>{address}</Text>
        </Card>
        <Button label="Copy address" icon={Copy} onPress={() => void copy()} />
        <Button label="View on explorer" icon={ExternalLink} kind="secondary" onPress={() => address && void WebBrowser.openBrowserAsync(explorerAddress(1, address))} />
      </Sheet>

      <Sheet visible={action === "swap" || action === "bridge"} onClose={() => setAction(null)} title={action === "swap" ? "Swap" : "Bridge"}>
        <EmptyState
          icon={action === "swap" ? Repeat : ArrowLeftRight}
          title={action === "swap" ? "Swapping arrives in Phase 4" : "Bridging arrives in Phase 4"}
          body={action === "swap" ? "Real quotes from 0x and other aggregators, with every fee shown before you sign." : "Move assets between networks through vetted bridges, tracked until they arrive."}
        />
        <Button label="Got it" kind="secondary" onPress={() => setAction(null)} />
      </Sheet>
    </Screen>
  );
}
