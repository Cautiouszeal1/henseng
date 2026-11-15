import { formatTokenAmount, shortAddress } from "@henseng/wallet";
import * as WebBrowser from "expo-web-browser";
import { ArrowDownLeft, ArrowUpRight, History, ImageIcon } from "lucide-react-native";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Card, EmptyState, Pill, SectionHeader, Tap, Text } from "../ui/primitives";
import { useTheme } from "../ui/theme";
import { useActivity } from "../wallet/activity";
import { explorerAddress, explorerTx, networkInfo } from "../wallet/networks";
import { useTransferHistory } from "../wallet/use-indexer";

type Row = {
  key: string;
  hash: string;
  chainId: number;
  direction: "in" | "out";
  title: string;
  amount: string | null;
  counterparty: string;
  time: number | null;
  status: "pending" | "confirmed" | "failed";
  note?: string;
};

function timeAgo(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Sends made here (with live status) merged with indexed incoming and outgoing transfers. */
export function WalletActivity({ includeTestnets, mask, address }: { includeTestnets: boolean; mask: (s: string) => string; address: string | null }) {
  const { theme } = useTheme();
  const { items } = useActivity();
  const history = useTransferHistory(includeTestnets);
  const [showUnverified, setShowUnverified] = useState(false);

  const { rows, hiddenCount } = useMemo(() => {
    const local: Row[] = items
      .filter((i) => includeTestnets || !networkInfo(i.chainId)?.testnet)
      .map((i) => ({
        key: `l:${i.hash}`,
        hash: i.hash,
        chainId: i.chainId,
        direction: "out",
        title:
          i.kind === "swap"
            ? `Swapped ${i.symbol} → ${i.toSymbol}`
            : i.kind === "bridge"
              ? `Bridged ${i.symbol} to ${networkInfo(i.toChainId ?? 0)?.name ?? "another network"}`
              : i.kind === "approve"
                ? `Allowed ${i.toLabel ?? "an app"} to use ${i.symbol}`
                : i.kind === "dapp"
                  ? `Transaction on ${i.toLabel ?? "a website"}`
                  : `Sent ${i.symbol}`,
        amount: formatTokenAmount(BigInt(i.amount), i.decimals),
        counterparty: i.kind === "send" ? i.toLabel ?? shortAddress(i.to) : i.kind === "dapp" ? shortAddress(i.to) : `via ${i.toLabel ?? "LI.FI"}`,
        time: i.createdAt,
        status: i.kind === "bridge" && i.status === "confirmed" && i.bridge !== "done" ? (i.bridge === "pending" ? "pending" : i.bridge === "partial" || i.bridge === "refunded" ? "confirmed" : "failed") : i.status,
        note: i.kind === "bridge" ? (i.bridge === "pending" && i.status === "confirmed" ? "Arriving" : i.bridge === "refunded" ? "Refunded" : i.bridge === "partial" ? "Arrived (other token)" : i.bridge === "unknown" ? "Check explorer" : undefined) : undefined,
      }));
    const seen = new Set(items.map((i) => i.hash.toLowerCase()));
    let hidden = 0;
    const indexed: Row[] = [];
    for (const t of history.items) {
      if (seen.has(t.hash.toLowerCase())) continue;
      if (t.kind === "token" && !t.verified && t.direction === "in" && !showUnverified) {
        hidden++;
        continue;
      }
      const what = t.kind === "nft" ? `NFT${t.symbol ? ` · ${t.symbol.slice(0, 24)}` : ""}` : (t.symbol ?? "token").slice(0, 16);
      indexed.push({
        key: `i:${t.id}`,
        hash: t.hash,
        chainId: t.chainId,
        direction: t.direction,
        title: `${t.direction === "in" ? "Received" : "Sent"} ${what}${t.kind === "token" && !t.verified ? " (unverified)" : ""}`,
        amount: t.kind === "nft" ? (t.tokenId ? `#${t.tokenId.length > 8 ? `${t.tokenId.slice(0, 6)}…` : t.tokenId}` : null) : t.amount && t.decimals !== null ? formatTokenAmount(BigInt(t.amount), t.decimals) : null,
        counterparty: shortAddress(t.counterparty),
        time: t.timestamp ? Date.parse(t.timestamp) : null,
        status: "confirmed",
      });
    }
    return { rows: [...local, ...indexed].sort((a, b) => (b.time ?? 0) - (a.time ?? 0)).slice(0, 30), hiddenCount: hidden };
  }, [items, history.items, includeTestnets, showUnverified]);

  const footer =
    history.status === "not_configured"
      ? "Incoming transfers will appear once history is set up on the HENSENG server. Sends you make here are always listed."
      : history.status === "off"
        ? "Sign in to HENSENG to see incoming transfers. Sends you make here are always listed."
        : history.status === "error"
          ? "History couldn't be loaded right now. Sends you make here are still listed."
          : history.status === "partial"
            ? "Some networks' history couldn't be loaded."
            : "Ethereum, Base and Arbitrum history. Solana shows sends made in HENSENG.";

  return (
    <View>
      <SectionHeader title="Activity" />
      <Card padded={!rows.length}>
        {rows.length ? (
          rows.map((r, i) => {
            const net = networkInfo(r.chainId);
            const Icon = r.direction === "in" ? ArrowDownLeft : r.title.startsWith("Sent NFT") || r.title.startsWith("Received NFT") ? ImageIcon : ArrowUpRight;
            return (
              <Tap key={r.key} onPress={() => void WebBrowser.openBrowserAsync(explorerTx(r.chainId, r.hash))} accessibilityRole="link" accessibilityLabel={`${r.title}${r.amount ? ` ${r.amount}` : ""} on ${net?.name}, ${r.status}. Open in explorer`} haptic={false} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: r.direction === "in" ? theme.positive + "1F" : theme.surface, alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} color={r.direction === "in" ? theme.positive : theme.text} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="subheading" numberOfLines={1}>{r.title}</Text>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {r.counterparty.startsWith("via ") ? r.counterparty : `${r.direction === "in" ? "From" : "To"} ${r.counterparty}`} · {net?.name}{r.time ? ` · ${timeAgo(r.time)}` : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  {r.amount ? <Text variant="bodyStrong" style={{ color: r.direction === "in" ? theme.positive : theme.text }}>{r.amount.startsWith("#") ? "" : r.direction === "in" ? "+" : "−"}{mask(r.amount)}</Text> : null}
                  {r.status !== "confirmed" || r.key.startsWith("l:") ? (
                    <Pill label={r.note ?? (r.status === "pending" ? "Pending" : r.status === "confirmed" ? "Confirmed" : "Failed")} tone={r.status === "pending" ? "warning" : r.status === "confirmed" ? "positive" : "negative"} />
                  ) : null}
                </View>
              </Tap>
            );
          })
        ) : (
          <EmptyState
            icon={History}
            title={history.status === "loading" ? "Loading activity…" : "No activity yet"}
            body="Transfers in and out of your wallet show here."
            action={address ? { label: "View address on Etherscan", onPress: () => void WebBrowser.openBrowserAsync(explorerAddress(1, address)) } : undefined}
          />
        )}
      </Card>
      {hiddenCount ? (
        <Tap onPress={() => setShowUnverified(true)} accessibilityRole="button" style={{ marginTop: 8, padding: 4 }}>
          <Text variant="caption" tone="accent">{`Show ${hiddenCount} hidden transfer${hiddenCount === 1 ? "" : "s"} of unverified tokens`}</Text>
        </Tap>
      ) : null}
      {showUnverified ? <Text variant="caption" style={{ marginTop: 4, color: theme.warning }}>Unverified tokens are often airdropped scams. Never visit links in their names.</Text> : null}
      <Text variant="caption" tone="tertiary" style={{ marginTop: 8 }}>{footer}</Text>
    </View>
  );
}
