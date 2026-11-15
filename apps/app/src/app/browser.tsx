import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Check, Copy, ExternalLink, Lock, MoreHorizontal, RotateCw, Unlink, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bytesToHex } from "viem";
import { ApprovalSheet } from "../dapp/approval-sheet";
import { handleRequest, ProviderError, type Approval, type BridgeDeps } from "../dapp/bridge";
import { DappWebView, IN_APP_BROWSER, type DappWebViewHandle } from "../dapp/dapp-webview";
import { isSiteConnected, rememberSiteChain, setSiteConnected, siteChain } from "../dapp/permissions";
import { buildProviderScript, deliverScript } from "../dapp/provider-script";
import { Sheet, useToast } from "../ui/overlays";
import { IconButton, Tap, Text } from "../ui/primitives";
import { useTheme } from "../ui/theme";
import { radius } from "../ui/tokens";
import { useActivity } from "../wallet/activity";
import { NETWORKS, networkInfo, publicClient } from "../wallet/networks";
import { sendErrorMessage } from "../wallet/send";
import { useWallet } from "../wallet/wallet-context";

/** Only https pages get a wallet. Returns the page's origin, or null. */
function httpsOrigin(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || (__DEV__ && u.hostname === "localhost") || process.env.EXPO_PUBLIC_DAPP_IFRAME_TEST === "1" ? u.origin : null;
  } catch {
    return null;
  }
}
const hostOf = (origin: string | null) => (origin ? origin.replace(/^https?:\/\//, "") : "");

/**
 * The in-app dApp browser. Websites see HENSENG as their wallet (window.ethereum / EIP-6963).
 * Every connection, signature and transaction is approved here; keys never reach the page.
 */
export default function Browser() {
  const { url: startUrl } = useLocalSearchParams<{ url: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const wallet = useWallet();
  const activity = useActivity();
  const web = useRef<DappWebViewHandle>(null);

  const secret = useMemo(() => bytesToHex(crypto.getRandomValues(new Uint8Array(16))).slice(2), []);
  const uuid = useMemo(() => {
    const h = bytesToHex(crypto.getRandomValues(new Uint8Array(16))).slice(2);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  }, []);

  const startOrigin = httpsOrigin(startUrl ?? "");
  const [chainId, setChainIdState] = useState<number | null>(null);
  const chainRef = useRef(1);
  const [page, setPage] = useState({ url: startUrl ?? "", title: "", canGoBack: false, loading: true });
  const [progress, setProgress] = useState(0);
  const [connected, setConnected] = useState(false);
  const [queue, setQueue] = useState<{ a: Approval; resolve: (ok: boolean) => void }[]>([]);
  const [menu, setMenu] = useState<null | "menu" | "network">(null);
  const origin = httpsOrigin(page.url);
  const originRef = useRef(origin);
  originRef.current = origin;

  // On web and in the extension sites can't be embedded: open a normal tab instead.
  useEffect(() => {
    if (IN_APP_BROWSER || !startUrl) return;
    if (startOrigin) void WebBrowser.openBrowserAsync(startUrl);
    router.back();
  }, [startUrl, startOrigin]);

  // The network the site starts on: what it used last time, else Ethereum.
  useEffect(() => {
    if (!startOrigin) return;
    void siteChain(startOrigin).then((c) => {
      const id = c && NETWORKS.some((n) => n.id === c) ? c : 1;
      chainRef.current = id;
      setChainIdState(id);
    });
  }, [startOrigin]);

  useEffect(() => {
    if (origin) void isSiteConnected(origin).then(setConnected);
  }, [origin]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (page.canGoBack) {
        web.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [page.canGoBack]);

  const send = useCallback((msg: object) => web.current?.inject(deliverScript({ ...msg, s: secret })), [secret]);
  const emit = useCallback<BridgeDeps["emit"]>((event, data) => send({ t: "ev", event, data }), [send]);

  const switchChain = useCallback(
    (id: number) => {
      chainRef.current = id;
      setChainIdState(id);
      if (originRef.current) void rememberSiteChain(originRef.current, id);
    },
    [],
  );

  const deps = useMemo<BridgeDeps | null>(() => {
    if (!wallet.address) return null;
    return {
      address: wallet.address,
      supportedChains: NETWORKS.map((n) => n.id),
      getChainId: () => chainRef.current,
      setChainId: switchChain,
      isConnected: isSiteConnected,
      setConnected: async (o, c) => {
        await setSiteConnected(o, c, chainRef.current);
        if (o === originRef.current) setConnected(c);
      },
      approve: (a) => new Promise<boolean>((resolve) => setQueue((q) => [...q, { a, resolve }])),
      signMessage: wallet.signDappMessage,
      signTypedData: wallet.signTypedData,
      sendTransaction: async (tx) => {
        const hash = await wallet.sendTransaction(tx);
        activity.add({ hash, chainId: tx.chainId, kind: "dapp", symbol: "ETH", decimals: 18, amount: (tx.value ?? 0n).toString(), to: tx.to, toLabel: hostOf(originRef.current) });
        return hash;
      },
      rpc: (id, method, params) => publicClient(id).request({ method: method as any, params: params as any }),
      emit,
    };
  }, [wallet.address, wallet.signDappMessage, wallet.signTypedData, wallet.sendTransaction, activity, emit, switchChain]);

  const onMessage = useCallback(
    (data: string, pageUrl: string) => {
      let msg: { s?: string; t?: string; id?: number; method?: string; params?: unknown };
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }
      if (msg.s !== secret || msg.t !== "req" || typeof msg.id !== "number" || typeof msg.method !== "string") return;
      const o = httpsOrigin(pageUrl);
      const reply = (r: { result?: unknown; error?: { code: number; message: string } }) => send({ t: "res", id: msg.id, ...r });
      if (!o || !deps) return reply({ error: { code: 4100, message: "This page can't use the wallet." } });
      wallet.touch();
      handleRequest(o, msg.method, msg.params, deps)
        .then((result) => reply({ result: result === undefined ? null : result }))
        .catch((e) =>
          reply({ error: e instanceof ProviderError ? { code: e.code, message: e.message } : { code: -32603, message: msg.method === "eth_sendTransaction" ? sendErrorMessage(e) : e instanceof Error ? e.message : "Request failed." } }),
        );
    },
    [secret, deps, send, wallet],
  );

  const onNav = useCallback(
    (n: { url: string; title?: string; canGoBack: boolean; loading: boolean }) => {
      const before = originRef.current;
      setPage({ url: n.url, title: n.title ?? "", canGoBack: n.canGoBack, loading: n.loading });
      const o = httpsOrigin(n.url);
      if (o && o !== before) {
        void siteChain(o).then((c) => {
          if (c && c !== chainRef.current && NETWORKS.some((x) => x.id === c)) {
            switchChain(c);
            emit("chainChanged", `0x${c.toString(16)}`);
          }
        });
      }
    },
    [emit, switchChain],
  );

  const script = useMemo(() => (chainId ? buildProviderScript({ chainId, secret, uuid, mainFrameOnly: Platform.OS !== "web" }) : ""), [chainId === null, secret, uuid]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = queue[0] ?? null;
  const finish = (ok: boolean) => {
    current?.resolve(ok);
    setQueue((q) => q.slice(1));
  };
  const net = chainId ? networkInfo(chainId) : undefined;

  if (!startOrigin) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + 16, paddingHorizontal: 20, gap: 16 }}>
        <IconButton icon={X} label="Close browser" onPress={() => router.back()} />
        <Text variant="heading">HENSENG only opens secure (https) sites.</Text>
      </View>
    );
  }
  if (!IN_APP_BROWSER) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 8, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <IconButton icon={X} label="Close browser" onPress={() => router.back()} size={38} />
        <IconButton icon={ArrowLeft} label="Back" onPress={() => web.current?.goBack()} size={38} />
        <View style={{ flex: 1, paddingHorizontal: 6 }} accessibilityLabel={`Site ${hostOf(origin)}${connected ? ", connected" : ""}`}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Lock size={12} color={theme.positive} />
            <Text variant="subheading" numberOfLines={1} style={{ flexShrink: 1 }}>{hostOf(origin) || "Loading…"}</Text>
            {connected ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.positive }} /> : null}
          </View>
          {page.title ? <Text variant="caption" tone="tertiary" numberOfLines={1}>{page.title}</Text> : null}
        </View>
        <Tap onPress={() => setMenu("network")} accessibilityRole="button" accessibilityLabel={`Network: ${net?.name ?? ""}. Change network`} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: net?.color ?? theme.accent }} />
          <Text variant="caption">{net?.short ?? "…"}</Text>
        </Tap>
        <IconButton icon={MoreHorizontal} label="Site options" onPress={() => setMenu("menu")} size={38} />
      </View>
      {page.loading && progress < 1 ? <View style={{ height: 2, width: `${Math.max(8, progress * 100)}%`, backgroundColor: theme.accent }} /> : null}

      {chainId && wallet.address ? (
        <DappWebView
          ref={web}
          url={startUrl!}
          injectedScript={script}
          onMessage={onMessage}
          onNav={onNav}
          onProgress={setProgress}
          onBlocked={(u) => toast(u.startsWith("http:") ? "HENSENG only opens secure (https) pages." : "This link tries to open another app, so HENSENG blocked it.", "info")}
        />
      ) : null}

      <ApprovalSheet request={current?.a ?? null} onDone={finish} />

      <Sheet visible={menu === "network"} onClose={() => setMenu(null)} title="Network for this site">
        {NETWORKS.map((n) => (
          <Tap
            key={n.id}
            onPress={() => {
              setMenu(null);
              if (n.id !== chainRef.current) {
                switchChain(n.id);
                emit("chainChanged", `0x${n.id.toString(16)}`);
              }
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: n.id === chainId }}
            accessibilityLabel={n.name}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: n.color }} />
            <Text style={{ flex: 1 }}>{n.name}{n.testnet ? " (testnet)" : ""}</Text>
            {n.id === chainId ? <Check size={18} color={theme.accent} /> : null}
          </Tap>
        ))}
      </Sheet>

      <Sheet visible={menu === "menu"} onClose={() => setMenu(null)} title={hostOf(origin)}>
        {[
          { icon: RotateCw, label: "Reload", run: () => web.current?.reload() },
          ...(connected && origin
            ? [{ icon: Unlink, label: "Disconnect this site", run: async () => {
                await setSiteConnected(origin, false, chainRef.current);
                setConnected(false);
                emit("accountsChanged", []);
                toast(`Disconnected ${hostOf(origin)}`, "info");
              } }]
            : []),
          { icon: Copy, label: "Copy link", run: async () => { await Clipboard.setStringAsync(page.url); toast("Link copied", "info"); } },
          { icon: ExternalLink, label: "Open in your browser", run: () => void WebBrowser.openBrowserAsync(page.url) },
        ].map((item) => (
          <Tap key={item.label} onPress={() => { setMenu(null); void item.run(); }} accessibilityRole="button" accessibilityLabel={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
            <item.icon size={20} color={theme.textSecondary} />
            <Text>{item.label}</Text>
          </Tap>
        ))}
        <Text variant="caption" tone="tertiary">Connected sites can see your address. They can't move funds without your approval each time.</Text>
      </Sheet>
    </View>
  );
}
