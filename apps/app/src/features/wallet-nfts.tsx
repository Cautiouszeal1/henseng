import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { ExternalLink, ImageIcon, ShieldAlert } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Sheet } from "../ui/overlays";
import { Button, Card, EmptyState, Pill, Skeleton, Tap, Text } from "../ui/primitives";
import { useLayout, useTheme } from "../ui/theme";
import { radius } from "../ui/tokens";
import { networkInfo } from "../wallet/networks";
import { useNfts, type Nft } from "../wallet/use-indexer";

function NftImage({ uri, size, label }: { uri: string | null; size: number | "100%"; label: string }) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View accessibilityLabel={`${label}, no image`} style={{ width: size, aspectRatio: 1, borderRadius: radius.md, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" }}>
        <ImageIcon size={28} color={theme.textTertiary} />
      </View>
    );
  }
  return <Image source={{ uri }} accessibilityLabel={label} contentFit="cover" onError={() => setFailed(true)} style={{ width: size, aspectRatio: 1, borderRadius: radius.md, backgroundColor: theme.surface }} />;
}

const explorerNft = (n: Nft) => `${networkInfo(n.chainId)?.explorer ?? "https://etherscan.io"}/nft/${n.contract}/${n.tokenId}`;

/** NFTs you hold on Ethereum, Base and Arbitrum (from the HENSENG indexer). View only for now. */
export function WalletNfts({ includeTestnets }: { includeTestnets: boolean }) {
  const { theme } = useTheme();
  const { isDesktop } = useLayout();
  const { items, hidden, status, message } = useNfts(includeTestnets);
  const [open, setOpen] = useState<Nft | null>(null);
  const cols = isDesktop ? 3 : 2;

  if (status === "off" || status === "not_configured") {
    return (
      <Card>
        <EmptyState icon={ImageIcon} title="NFTs aren't available here yet" body={status === "off" ? "Sign in to HENSENG to see your NFTs." : message ?? "NFTs will appear once the HENSENG server's indexer is set up."} />
      </Card>
    );
  }
  if (status === "loading") {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} width={`${100 / cols - 4}%`} height={160} radius={radius.md} />)}
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      {status === "error" ? <Text tone="negative">NFTs couldn't be loaded right now. Try Refresh.</Text> : null}
      {items.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}>
          {items.map((n) => {
            const net = networkInfo(n.chainId);
            return (
              <View key={n.id} style={{ width: `${100 / cols}%`, padding: 6 }}>
                <Tap onPress={() => setOpen(n)} accessibilityRole="button" accessibilityLabel={`${n.name}${n.collection ? `, ${n.collection}` : ""}, on ${net?.name}`} haptic={false} style={{ gap: 8, padding: 8, borderRadius: radius.lg, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}>
                  <NftImage uri={n.thumbnail ?? n.image} size="100%" label={n.name} />
                  <View style={{ gap: 2, paddingHorizontal: 2 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>{n.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: net?.color }} />
                      <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>{n.collection ?? net?.name}</Text>
                      {n.standard === "ERC1155" && n.balance !== "1" ? <Text variant="label" tone="secondary">×{n.balance}</Text> : null}
                    </View>
                  </View>
                </Tap>
              </View>
            );
          })}
        </View>
      ) : (
        <Card>
          <EmptyState icon={ImageIcon} title="No NFTs yet" body="NFTs you hold on Ethereum, Base and Arbitrum appear here." />
        </Card>
      )}
      {hidden ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <ShieldAlert size={14} color={theme.textTertiary} />
          <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>{`${hidden} spam NFT${hidden === 1 ? "" : "s"} hidden. Spam NFTs often link to scams; never connect your wallet to sites they mention.`}</Text>
        </View>
      ) : null}
      <Text variant="caption" tone="tertiary">Viewing only for now: sending NFTs and Solana NFTs come later.</Text>

      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open?.name ?? ""}>
        {open ? (
          <>
            <NftImage uri={open.image ?? open.thumbnail} size="100%" label={open.name} />
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {open.collection ? <Pill label={open.collection} /> : null}
              <Pill label={networkInfo(open.chainId)?.name ?? ""} />
              {open.standard !== "UNKNOWN" ? <Pill label={open.standard.replace("ERC", "ERC-")} /> : null}
              {open.standard === "ERC1155" ? <Pill label={`You hold ${open.balance}`} /> : null}
            </View>
            {open.description ? <Text tone="secondary" numberOfLines={8}>{open.description}</Text> : null}
            <Card style={{ gap: 6 }}>
              <Text variant="label" tone="secondary">Contract</Text>
              <Text variant="mono" selectable>{open.contract}</Text>
              <Text variant="label" tone="secondary">Token ID</Text>
              <Text variant="mono" selectable numberOfLines={2}>{open.tokenId}</Text>
            </Card>
            <Button label="View on explorer" icon={ExternalLink} kind="secondary" onPress={() => void WebBrowser.openBrowserAsync(explorerNft(open))} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}
