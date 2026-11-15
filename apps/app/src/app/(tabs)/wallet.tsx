import { formatTokenAmount, shortAddress } from "@henseng/wallet";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpRight, Bell, Copy, ExternalLink, Eye, EyeOff, Lock, Plus, RefreshCw, Repeat, ScanLine, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Switch, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { WalletActivity } from "../../features/wallet-activity";
import { WalletNfts } from "../../features/wallet-nfts";
import { Sheet, useToast } from "../../ui/overlays";
import { Button, Card, EmptyState, Field, IconButton, Pill, Skeleton, Tap, Text } from "../../ui/primitives";
import { Screen } from "../../ui/screen";
import { useLayout, useTheme } from "../../ui/theme";
import { radius } from "../../ui/tokens";
import { explorerAddress, NETWORKS } from "../../wallet/networks";
import { TokenIcon } from "../../wallet/token-icon";
import { formatUsd, usePortfolio, type Holding } from "../../wallet/use-portfolio";
import { useWallet } from "../../wallet/wallet-context";

type SheetName = "receive" | "send" | "swap" | "bridge" | "add" | null;

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

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const { theme } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: theme.surface, alignSelf: "flex-start" }}>
      {options.map(([v, label]) => (
        <Tap key={v} onPress={() => onChange(v)} accessibilityRole="tab" accessibilityState={{ selected: value === v }} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: value === v ? theme.card : "transparent" }}>
          <Text variant="bodyStrong" style={{ color: value === v ? theme.text : theme.textSecondary, fontSize: 14 }}>{label}</Text>
        </Tap>
      ))}
    </View>
  );
}

const openSend = (h?: Pick<Holding, "token" | "network">) =>
  h?.network.kind === "solana"
    ? router.push({ pathname: "/send-solana", params: { chainId: String(h.token.chainId), token: h.token.address ?? "native" } })
    : router.push(h ? { pathname: "/send", params: { chainId: String(h.token.chainId), token: h.token.address ?? "native" } } : "/send");

export default function WalletScreen() {
  const { theme } = useTheme();
  const { isDesktop } = useLayout();
  const { address, solanaAddress, lock } = useWallet();
  const toast = useToast();
  const p = usePortfolio();
  const [hidden, setHidden] = useState(false);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [view, setView] = useState<"tokens" | "nfts">("tokens");
  const [receiveOn, setReceiveOn] = useState<"evm" | "solana">("evm");
  const [addNet, setAddNet] = useState(8453);
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const mask = (s: string) => (hidden ? "••••••" : s);

  const copy = async (value: string | null) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    toast("Address copied", "success");
  };

  const firstSolana = p.holdings.find((h) => h.network.kind === "solana" && h.balance > 0n);
  const hasEvmFunds = p.holdings.some((h) => h.network.kind === "evm" && h.balance > 0n);
  const onSend = () => (firstSolana && hasEvmFunds ? setSheet("send") : firstSolana ? openSend(firstSolana) : openSend());

  const addToken = async () => {
    setAdding(true);
    setAddError(null);
    const r = await p.addCustomToken(addNet, addInput);
    setAdding(false);
    if ("error" in r) return setAddError(r.error);
    toast(`${r.token.symbol} added`, "success");
    setAddInput("");
    setSheet(null);
  };

  const firstLoad = p.loading && !p.updatedAt;
  const mainnetsDown = p.statuses.filter((s) => !s.network.testnet).every((s) => s.status === "error");
  const totalNote = (() => {
    if (firstLoad) return "Reading balances from each network…";
    if (mainnetsDown) return "No network could be reached. Check your connection and tap Refresh.";
    if (p.prices.status === "off") return "USD values need the HENSENG server, which this build isn't connected to.";
    if (p.prices.status === "error") return "Prices couldn't be loaded, so there's no USD total right now. Your balances below are live.";
    if (p.prices.status === "loading") return "Loading prices…";
    const down = p.failedNetworks.filter((n) => !n.testnet);
    const parts = [down.length ? `${down.map((n) => n.name).join(", ")} couldn't be reached, so this total is partial.` : "Ethereum, Base, Arbitrum and Solana. Testnet tokens aren't counted."];
    if (p.hasCustomHoldings) parts.push("Tokens you added aren't counted.");
    return parts.join(" ");
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
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Tap onPress={() => void copy(address)} accessibilityLabel={`Copy Ethereum address ${address}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.1)" }}>
            <Text variant="mono" style={{ color: "#FFFFFF" }}>{address ? shortAddress(address) : "—"}</Text>
            <Copy size={14} color="#FFFFFF" />
          </Tap>
          {solanaAddress ? (
            <Tap onPress={() => void copy(solanaAddress)} accessibilityLabel={`Copy Solana address ${solanaAddress}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.1)" }}>
              <Text variant="mono" style={{ color: "#FFFFFF" }}>◎ {solanaAddress.slice(0, 4)}…{solanaAddress.slice(-4)}</Text>
              <Copy size={14} color="#FFFFFF" />
            </Tap>
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );

  const actions = (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <ActionButton icon={ArrowDownToLine} label="Receive" onPress={() => setSheet("receive")} />
      <ActionButton icon={ArrowUpRight} label="Send" onPress={onSend} />
      <ActionButton icon={Repeat} label="Swap" onPress={() => setSheet("swap")} />
      <ActionButton icon={ArrowLeftRight} label="Bridge" onPress={() => setSheet("bridge")} />
    </View>
  );

  const tokenRows = (
    <View>
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
                <View key={h.key} style={{ flexDirection: "row", alignItems: "center", borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
                  <Tap onPress={() => openSend(h)} accessibilityRole="button" accessibilityLabel={`${h.token.name} on ${h.network.name}: ${formatTokenAmount(h.balance, h.token.decimals)} ${h.token.symbol}. Send`} haptic={false} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: 16, paddingRight: h.token.custom ? 4 : 16, paddingVertical: 14 }}>
                    <TokenIcon symbol={h.token.symbol} network={h.network} />
                    <View style={{ flex: 1 }}>
                      <Text variant="subheading" numberOfLines={1}>{h.token.name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text variant="caption" tone="secondary">{h.network.name}{price && !h.network.testnet ? ` · ${formatUsd(price.usd)}` : ""}</Text>
                        {h.network.testnet ? <Pill label="Testnet" tone="warning" /> : null}
                        {h.token.custom ? <Pill label="Unverified" tone="warning" /> : null}
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text variant="bodyStrong" style={{ fontVariant: ["tabular-nums"] }}>{mask(formatTokenAmount(h.balance, h.token.decimals))} {h.token.symbol}</Text>
                      {h.usd !== undefined ? <Text variant="caption" tone="secondary">{mask(formatUsd(h.usd))}</Text> : null}
                    </View>
                  </Tap>
                  {h.token.custom ? (
                    <IconButton icon={Trash2} label={`Remove ${h.token.symbol} from wallet`} tone="plain" onPress={() => { p.removeCustomToken(h.token); toast(`${h.token.symbol} removed`, "success"); }} />
                  ) : null}
                </View>
              );
            })}
        {p.failedNetworks.map((n) => (
          <View key={n.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: n.color }} />
            <Text variant="caption" tone="negative" style={{ flex: 1 }}>{n.name} couldn't be reached</Text>
          </View>
        ))}
      </Card>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8 }}>
        <Tap onPress={() => { setAddError(null); setSheet("add"); }} accessibilityRole="button" accessibilityLabel="Add a token" style={{ flexDirection: "row", gap: 6, alignItems: "center", padding: 4 }}>
          <Plus size={14} color={theme.accent} />
          <Text variant="caption" tone="accent">Add a token</Text>
        </Tap>
        <Tap onPress={p.refresh} accessibilityRole="button" accessibilityLabel="Refresh balances" style={{ flexDirection: "row", gap: 6, alignItems: "center", padding: 4 }}>
          <RefreshCw size={14} color={theme.accent} />
          <Text variant="caption" tone="accent">Refresh</Text>
        </Tap>
      </View>
      <Text variant="caption" tone="tertiary" style={{ marginTop: 6 }}>{p.updatedAt ? `Read live from each network · ${p.updatedAt.toLocaleTimeString()}` : "Reading balances…"}</Text>
    </View>
  );

  const assets = (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <Segmented value={view} onChange={setView} options={[["tokens", "Tokens"], ["nfts", "NFTs"]]} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text variant="caption" tone="secondary">Testnets</Text>
          <Switch value={p.includeTestnets} onValueChange={p.setIncludeTestnets} trackColor={{ true: theme.accent, false: theme.surface }} thumbColor="#FFFFFF" accessibilityLabel="Show testnets" />
        </View>
      </View>
      {view === "tokens" ? tokenRows : <WalletNfts includeTestnets={p.includeTestnets} />}
    </View>
  );

  const history = <WalletActivity includeTestnets={p.includeTestnets} mask={mask} address={address} />;
  const receiveAddress = receiveOn === "evm" ? address : solanaAddress;

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

      <Sheet visible={sheet === "receive"} onClose={() => setSheet(null)} title="Receive">
        <Segmented value={receiveOn} onChange={setReceiveOn} options={[["evm", "Ethereum · Base · Arbitrum"], ["solana", "Solana"]]} />
        <Text tone="secondary">
          {receiveOn === "evm"
            ? "This address works on Ethereum, Base, Arbitrum and their testnets. Don't send Solana assets to it."
            : "Your Solana address, from the same recovery phrase (it opens in Phantom too). Only send SOL and Solana tokens to it."}
        </Text>
        <View style={{ alignSelf: "center", padding: 16, borderRadius: radius.lg, backgroundColor: "#FFFFFF" }}>
          {receiveAddress ? <QRCode value={receiveAddress} size={200} color="#101014" backgroundColor="#FFFFFF" /> : null}
        </View>
        <Card style={{ gap: 6 }}>
          <Text variant="label" tone="secondary">{receiveOn === "evm" ? "Your address" : "Your Solana address"}</Text>
          <Text variant="mono" selectable>{receiveAddress}</Text>
        </Card>
        <Button label="Copy address" icon={Copy} onPress={() => void copy(receiveAddress)} />
        <Button label="View on explorer" icon={ExternalLink} kind="secondary" onPress={() => receiveAddress && void WebBrowser.openBrowserAsync(explorerAddress(receiveOn === "evm" ? 1 : 101, receiveAddress))} />
      </Sheet>

      <Sheet visible={sheet === "send"} onClose={() => setSheet(null)} title="Send from">
        <Button label="Ethereum, Base or Arbitrum" kind="secondary" onPress={() => { setSheet(null); openSend(); }} />
        <Button label="Solana" kind="secondary" onPress={() => { setSheet(null); if (firstSolana) openSend(firstSolana); }} />
      </Sheet>

      <Sheet visible={sheet === "add"} onClose={() => setSheet(null)} title="Add a token">
        <Text tone="secondary">Paste a token's contract address to track it. Anyone can create a token with any name, so only add tokens from a source you trust.</Text>
        <View style={{ gap: 8 }}>
          <Text variant="label" tone="secondary">Network</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {NETWORKS.filter((n) => p.includeTestnets || !n.testnet).map((n) => (
              <Tap key={n.id} onPress={() => { setAddNet(n.id); setAddError(null); }} accessibilityRole="radio" accessibilityState={{ selected: addNet === n.id }} accessibilityLabel={n.name} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 36, borderRadius: radius.full, backgroundColor: addNet === n.id ? theme.accentSoft : theme.surface, borderWidth: 1, borderColor: addNet === n.id ? theme.accent : "transparent" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n.color }} />
                <Text variant="caption" style={{ color: addNet === n.id ? theme.accent : theme.textSecondary }}>{n.name}</Text>
              </Tap>
            ))}
          </View>
        </View>
        <Field label="Contract address" value={addInput} onChangeText={(v) => { setAddInput(v); setAddError(null); }} placeholder="0x…" autoCapitalize="none" autoCorrect={false} error={addError} onSubmitEditing={() => void addToken()} />
        <Button label="Add token" loading={adding} disabled={!addInput.trim()} onPress={() => void addToken()} />
      </Sheet>

      <Sheet visible={sheet === "swap" || sheet === "bridge"} onClose={() => setSheet(null)} title={sheet === "swap" ? "Swap" : "Bridge"}>
        <EmptyState
          icon={sheet === "swap" ? Repeat : ArrowLeftRight}
          title={sheet === "swap" ? "Swapping arrives in Phase 4" : "Bridging arrives in Phase 4"}
          body={sheet === "swap" ? "Real quotes from 0x and other aggregators, with every fee shown before you sign." : "Move assets between networks through vetted bridges, tracked until they arrive."}
        />
        <Button label="Got it" kind="secondary" onPress={() => setSheet(null)} />
      </Sheet>
    </Screen>
  );
}
