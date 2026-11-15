import {
  checkQuote, ERC20_APPROVE_ABI, formatTokenAmount, LIFI_DIAMOND, NATIVE_TOKEN, parseAmountInput, SLIPPAGE_OPTIONS, SWAP_CHAIN_IDS,
  tokenKey, TOKENS, VALUE_LOSS_CONFIRM, VALUE_LOSS_WARN, valueLossPercent, type SwapQuote, type TokenInfo,
} from "@henseng/wallet";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowDownUp, ArrowLeft, Check, ChevronDown, ExternalLink, X, XCircle } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Switch, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { encodeFunctionData, formatUnits } from "viem";
import { useApi } from "../api/api-context";
import { ApiError } from "../api/types";
import { Sheet } from "../ui/overlays";
import { Button, Card, Field, IconButton, Pill, Tap, Text } from "../ui/primitives";
import { ScreenGlow } from "../ui/art";
import { useTheme } from "../ui/theme";
import { radius } from "../ui/tokens";
import { useActivity } from "../wallet/activity";
import { explorerTx, networkFor, publicClient } from "../wallet/networks";
import { estimateFee, sendErrorMessage } from "../wallet/send";
import { Notice } from "../wallet/send-ui";
import { TokenIcon } from "../wallet/token-icon";
import { formatUsd, usePortfolio } from "../wallet/use-portfolio";
import { passwordErrorMessage } from "../wallet/unlock-guard";
import { useWallet } from "../wallet/wallet-context";

type Mode = "swap" | "bridge";
type Side = { chainId: number; token: TokenInfo };
type QuoteState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ok"; quote: SwapQuote; at: number };
type Phase = "approving" | "requoting" | "swapping";

const QUOTE_TTL_MS = 50_000; // LI.FI quotes expire after about a minute; refresh before that
const tokensOn = (chainId: number) => TOKENS.filter((t) => t.chainId === chainId);
const addr = (t: TokenInfo) => t.address ?? NATIVE_TOKEN;
const param = (t: TokenInfo) => t.address ?? "native";
/** ETH kept back by Max for network fees */
const GAS_RESERVE = (chainId: number) => (chainId === 1 ? 5_000_000_000_000_000n : 500_000_000_000_000n);

function fmtDuration(s: number | null) {
  if (s === null) return "—";
  if (s < 60) return `~${Math.max(5, Math.round(s))} s`;
  return `~${Math.round(s / 60)} min`;
}

export default function SwapScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: Mode }>();
  const api = useApi();
  const { address, verifyPassword, sendTransaction } = useWallet();
  const portfolio = usePortfolio();
  const activity = useActivity();

  // Default "from": the mainnet holding worth the most.
  const initialFrom = useMemo<Side>(() => {
    const h = portfolio.holdings.find((x) => SWAP_CHAIN_IDS.includes(x.token.chainId as never) && !x.token.custom && x.balance > 0n);
    const token = h?.token ?? tokensOn(8453)[0]!;
    return { chainId: token.chainId, token };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [mode, setMode] = useState<Mode>(params.mode === "bridge" ? "bridge" : "swap");
  const [from, setFrom] = useState<Side>(initialFrom);
  const [to, setTo] = useState<Side>(() => {
    const t = tokensOn(initialFrom.chainId).find((x) => tokenKey(x) !== tokenKey(initialFrom.token) && x.symbol === "USDC") ?? tokensOn(initialFrom.chainId).find((x) => tokenKey(x) !== tokenKey(initialFrom.token))!;
    return { chainId: initialFrom.chainId, token: t };
  });
  const [amountInput, setAmountInput] = useState("");
  const [slippage, setSlippage] = useState<number>(SLIPPAGE_OPTIONS[0]);
  const [quote, setQuote] = useState<QuoteState>({ status: "idle" });
  const [picker, setPicker] = useState<null | "fromNet" | "fromToken" | "toNet" | "toToken">(null);
  const [step, setStep] = useState<"form" | "review" | "working" | "done">("form");
  const [ackLoss, setAckLoss] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [workError, setWorkError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const qid = useRef(0);

  // Keep the two sides consistent with the mode.
  useEffect(() => {
    if (mode === "swap" && to.chainId !== from.chainId) {
      const t = tokensOn(from.chainId).find((x) => x.symbol === to.token.symbol && tokenKey(x) !== tokenKey(from.token)) ?? tokensOn(from.chainId).find((x) => tokenKey(x) !== tokenKey(from.token))!;
      setTo({ chainId: from.chainId, token: t });
    }
    if (mode === "bridge" && to.chainId === from.chainId) {
      const dest = SWAP_CHAIN_IDS.find((c) => c !== from.chainId)!;
      setTo({ chainId: dest, token: tokensOn(dest).find((x) => x.symbol === from.token.symbol) ?? tokensOn(dest)[0]! });
    }
  }, [mode, from, to]);

  const balance = portfolio.balanceOf(from.token);
  const amount = parseAmountInput(amountInput, from.token.decimals);
  const amountError = !amountInput.trim() ? null : !amount.ok ? amount.reason : balance !== undefined && amount.value > balance ? `You have ${formatTokenAmount(balance, from.token.decimals)} ${from.token.symbol}.` : null;
  const ready = amount.ok && !amountError && !!address;

  const expectation = useCallback(
    (fromAmount: string) => ({ fromChain: from.chainId, toChain: to.chainId, fromToken: addr(from.token), toToken: addr(to.token), fromAmount, fromAddress: address! }),
    [from, to, address],
  );

  const fetchQuote = useCallback(async (): Promise<SwapQuote | null> => {
    if (!amount.ok || !address) return null;
    const id = ++qid.current;
    setQuote((q) => (q.status === "ok" ? q : { status: "loading" }));
    try {
      const q = await api.request<SwapQuote>(
        "GET",
        `/swap/quote?${new URLSearchParams({ fromChain: String(from.chainId), toChain: String(to.chainId), fromToken: param(from.token), toToken: param(to.token), fromAmount: amount.value.toString(), slippage: String(slippage) })}`,
      );
      // Defence in depth: check the quote here too, on the device that signs.
      const problem = checkQuote(q, expectation(amount.value.toString()));
      if (problem) throw new Error(`This quote was refused for your safety: ${problem}`);
      if (id === qid.current) setQuote({ status: "ok", quote: q, at: Date.now() });
      return q;
    } catch (e) {
      const message = e instanceof ApiError || e instanceof Error ? e.message : "Couldn't get a quote.";
      if (id === qid.current) setQuote({ status: "error", message });
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, address, from, to, slippage, amountInput, expectation]);

  // Debounced quote while editing; refreshed before it expires.
  useEffect(() => {
    setAckLoss(false);
    if (!ready || step !== "form") {
      qid.current++;
      setQuote({ status: "idle" });
      return;
    }
    setQuote({ status: "loading" });
    const t = setTimeout(() => void fetchQuote(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, amountInput, slippage, ready]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if ((step === "form" || step === "review") && quote.status === "ok" && now - quote.at > QUOTE_TTL_MS) void fetchQuote();
  }, [now, quote, step, fetchQuote]);

  const q = quote.status === "ok" ? quote.quote : null;
  const loss = q ? valueLossPercent(q) : null;
  const lossBlocks = loss !== null && loss >= VALUE_LOSS_CONFIRM && !ackLoss;
  const toNet = networkFor(to.chainId)!;
  const fromNet = networkFor(from.chainId)!;

  const setMax = () => {
    if (balance === undefined) return;
    const max = from.token.address ? balance : balance - GAS_RESERVE(from.chainId);
    setAmountInput(max > 0n ? formatUnits(max, from.token.decimals) : "0");
  };

  const flip = () => {
    if (mode !== "swap") return;
    setFrom(to);
    setTo(from);
    setAmountInput("");
  };

  const goReview = async () => {
    if (!q || !address) return;
    setWorkError(null);
    setPassword("");
    setPasswordError(null);
    if (from.token.address) {
      const allowance = await publicClient(from.chainId)
        .readContract({ address: from.token.address as `0x${string}`, abi: ERC20_APPROVE_ABI, functionName: "allowance", args: [address, LIFI_DIAMOND] })
        .catch(() => 0n);
      setNeedsApproval(allowance < BigInt(q.fromAmount));
    } else setNeedsApproval(false);
    setStep("review");
  };

  const execute = async () => {
    if (!q || !address) return;
    setPasswordError(null);
    setWorkError(null);
    let ok: boolean;
    try {
      ok = await verifyPassword(password);
    } catch (e) {
      return setPasswordError(passwordErrorMessage(e) ?? "Couldn't check your password.");
    }
    if (!ok) return setPasswordError("That password isn't right.");
    setStep("working");
    let current = q;
    try {
      if (needsApproval && from.token.address) {
        setPhase("approving");
        // Approve exactly this amount, only to the LI.FI Diamond. Never unlimited.
        const data = encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [LIFI_DIAMOND, BigInt(q.fromAmount)] });
        const fee = await estimateFee(address, { chainId: from.chainId, to: from.token.address as `0x${string}`, value: 0n, data });
        const h = await sendTransaction({ chainId: from.chainId, to: from.token.address as `0x${string}`, data, gas: fee.gas });
        activity.add({ hash: h, chainId: from.chainId, kind: "approve", symbol: from.token.symbol, decimals: from.token.decimals, amount: q.fromAmount, to: LIFI_DIAMOND, toLabel: "LI.FI" });
        const r = await publicClient(from.chainId).waitForTransactionReceipt({ hash: h, timeout: 180_000 });
        if (r.status !== "success") throw new Error("The approval was rejected by the network.");
        // Gas estimates go stale while the approval confirms: get a fresh quote.
        setPhase("requoting");
        const fresh = await fetchQuote();
        if (!fresh) throw new Error("Couldn't refresh the quote after approving. Your approval is done; try the swap again.");
        if (BigInt(fresh.toAmountMin) * 100n < BigInt(q.toAmountMin) * 99n) {
          setStep("review");
          setNeedsApproval(false);
          setWorkError(`The price moved while approving. You'd now get at least ${formatTokenAmount(BigInt(fresh.toAmountMin), to.token.decimals)} ${to.token.symbol}. Review and confirm again.`);
          return;
        }
        current = fresh;
      }
      setPhase("swapping");
      const problem = checkQuote(current, expectation(current.fromAmount));
      if (problem) throw new Error(`This quote was refused for your safety: ${problem}`);
      const tx = { chainId: from.chainId, to: current.tx.to as `0x${string}`, value: BigInt(current.tx.value), data: current.tx.data as `0x${string}` };
      // Simulate first: a swap that would fail is caught before you pay for it.
      const fee = await estimateFee(address, tx);
      const eth = portfolio.balanceOf({ chainId: from.chainId, address: null }) ?? 0n;
      if (fee.maxFee + tx.value > eth) throw new Error(`You need up to ${formatTokenAmount(fee.maxFee, 18)} ETH on ${fromNet.name} for the network fee.`);
      const h = await sendTransaction({ ...tx, gas: fee.gas });
      const bridging = from.chainId !== to.chainId;
      activity.add({
        hash: h,
        chainId: from.chainId,
        kind: bridging ? "bridge" : "swap",
        symbol: from.token.symbol,
        decimals: from.token.decimals,
        amount: current.fromAmount,
        to: current.tx.to,
        toLabel: current.toolName,
        maxFee: fee.maxFee.toString(),
        toSymbol: to.token.symbol,
        toDecimals: to.token.decimals,
        toAmount: current.toAmount,
        toChainId: to.chainId,
        ...(bridging ? { bridgeTool: current.tool, bridge: "pending" as const } : {}),
      });
      setHash(h);
      setStep("done");
    } catch (e) {
      setStep("review");
      setWorkError(e instanceof Error && e.message.startsWith("This quote") ? e.message : e instanceof Error && /You need up to|price moved|refresh the quote|approval was rejected/.test(e.message) ? e.message : sendErrorMessage(e));
    } finally {
      setPhase(null);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace("/wallet"));
  const title = mode === "swap" ? "Swap" : "Bridge";
  const header = (t: string, onBack?: () => void) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: insets.top + 8, paddingBottom: 8 }}>
      {onBack ? <IconButton icon={ArrowLeft} label="Back" tone="plain" onPress={onBack} /> : <View style={{ width: 44 }} />}
      <Text variant="heading" style={{ flex: 1, textAlign: "center" }} accessibilityRole="header">{t}</Text>
      <IconButton icon={X} label="Close" tone="plain" onPress={close} />
    </View>
  );
  const body = (children: React.ReactNode) => (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 32, width: "100%", maxWidth: 560, alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
  const row = (label: string, value: string, strong = false) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text tone="secondary">{label}</Text>
      <Text variant={strong ? "bodyStrong" : "body"} style={{ textAlign: "right", flexShrink: 1 }}>{value}</Text>
    </View>
  );

  const details = q ? (
    <Card style={{ gap: 10 }}>
      {row("Rate", `1 ${from.token.symbol} ≈ ${(Number(formatUnits(BigInt(q.toAmount), to.token.decimals)) / Number(formatUnits(BigInt(q.fromAmount), from.token.decimals))).toLocaleString("en-US", { maximumSignificantDigits: 6 })} ${to.token.symbol}`)}
      {row("Minimum you'll get", `${formatTokenAmount(BigInt(q.toAmountMin), to.token.decimals)} ${to.token.symbol}`, true)}
      {row("Route", q.toolName)}
      {row("Time", fmtDuration(q.durationSec))}
      {row("Network fee", q.gasUsd !== null ? `~${formatUsd(q.gasUsd)}` : "Shown in your wallet")}
      {q.fees.map((f, i) => (
        <View key={i}>{row(f.name, f.amountUsd !== null ? `${formatUsd(f.amountUsd)}${f.included ? " (included)" : ""}` : f.included ? "Included" : "Extra")}</View>
      ))}
      {loss !== null ? row("Value difference", `${loss.toFixed(2)}%`) : null}
    </Card>
  ) : null;

  /* ───────── Done ───────── */
  if (step === "done" && hash) {
    const item = activity.get(hash);
    const bridging = from.chainId !== to.chainId;
    const status = item?.status ?? "pending";
    const arrived = bridging ? item?.bridge === "done" : status === "confirmed";
    const failed = status === "failed" || item?.bridge === "failed";
    const text = failed
      ? "It didn't go through. If your funds left the wallet, the route refunds them; check the explorer."
      : item?.bridge === "refunded"
        ? `The bridge couldn't complete, so your ${from.token.symbol} was returned on ${fromNet.name}.`
        : item?.bridge === "partial"
          ? `Your funds arrived on ${toNet.name}, but as a different token than requested. Check your balances.`
          : item?.bridge === "unknown"
            ? "This is taking unusually long. Don't send it again; check the explorer for its status."
            : arrived
              ? `${item?.receivedAmount ? formatTokenAmount(BigInt(item.receivedAmount), to.token.decimals) : formatTokenAmount(BigInt(item?.toAmount ?? "0"), to.token.decimals)} ${to.token.symbol} is in your wallet on ${toNet.name}.`
              : bridging && status === "confirmed"
                ? `Sent from ${fromNet.name}. Arriving on ${toNet.name} — usually ${fmtDuration(q?.durationSec ?? null)}. You can leave this screen.`
                : "Waiting for the network to confirm…";
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {theme.mode === "dark" ? <ScreenGlow intensity={0.75} /> : null}
        {header(title)}
        {body(
          <>
            <View style={{ alignItems: "center", gap: 14, paddingVertical: 20 }}>
              <View style={{ width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", backgroundColor: (failed ? theme.negative : arrived ? theme.positive : theme.accent) + "22" }}>
                {failed ? <XCircle size={40} color={theme.negative} /> : arrived ? <Check size={40} color={theme.positive} /> : <ActivityIndicator color={theme.accent} size="large" />}
              </View>
              <Text variant="title" style={{ textAlign: "center" }}>{failed ? "Didn't go through" : arrived ? (bridging ? "Arrived" : "Swapped") : bridging ? (status === "confirmed" ? "Bridging…" : "Sending…") : "Swapping…"}</Text>
              <Text tone="secondary" style={{ textAlign: "center" }}>{text}</Text>
            </View>
            <Button label="View on explorer" icon={ExternalLink} kind="secondary" onPress={() => void WebBrowser.openBrowserAsync(explorerTx(from.chainId, hash))} />
            <Button label="Done" onPress={close} />
          </>,
        )}
      </View>
    );
  }

  /* ───────── Working ───────── */
  if (step === "working") {
    const steps: [Phase, string][] = [
      ...(needsApproval ? ([["approving", `Approve ${amountInput} ${from.token.symbol}`], ["requoting", "Refresh the quote"]] as [Phase, string][]) : []),
      ["swapping", mode === "swap" ? "Swap" : "Bridge"],
    ];
    const at = steps.findIndex(([p]) => p === phase);
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {theme.mode === "dark" ? <ScreenGlow intensity={0.75} /> : null}
        {header(title)}
        {body(
          <Card style={{ gap: 16 }}>
            {steps.map(([p, label], i) => (
              <View key={p} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {i < at ? <Check size={20} color={theme.positive} /> : i === at ? <ActivityIndicator color={theme.accent} /> : <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.border }} />}
                <Text variant={i === at ? "bodyStrong" : "body"} tone={i > at ? "tertiary" : "primary"}>{label}</Text>
              </View>
            ))}
            <Text variant="caption" tone="tertiary">Keep HENSENG open until this finishes.</Text>
          </Card>,
        )}
      </View>
    );
  }

  /* ───────── Review ───────── */
  if (step === "review" && q) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {theme.mode === "dark" ? <ScreenGlow intensity={0.75} /> : null}
        {header(`Review ${mode}`, () => setStep("form"))}
        {body(
          <>
            <Card style={{ gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <TokenIcon token={from.token} network={fromNet} size={40} />
                <View style={{ flex: 1 }}>
                  <Text variant="caption" tone="secondary">You pay · {fromNet.name}</Text>
                  <Text variant="heading">{formatTokenAmount(BigInt(q.fromAmount), from.token.decimals, 8)} {from.token.symbol}</Text>
                </View>
                {q.fromAmountUsd !== null ? <Text tone="secondary">{formatUsd(q.fromAmountUsd)}</Text> : null}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <TokenIcon token={to.token} network={toNet} size={40} />
                <View style={{ flex: 1 }}>
                  <Text variant="caption" tone="secondary">You get · {toNet.name}</Text>
                  <Text variant="heading">~{formatTokenAmount(BigInt(q.toAmount), to.token.decimals, 8)} {to.token.symbol}</Text>
                </View>
                {q.toAmountUsd !== null ? <Text tone="secondary">{formatUsd(q.toAmountUsd)}</Text> : null}
              </View>
            </Card>
            {details}
            {needsApproval ? (
              <Notice tone="info">{`Two steps: first you allow LI.FI to use exactly ${amountInput} ${from.token.symbol} (not more), then the ${mode} runs. Each needs a small network fee.`}</Notice>
            ) : null}
            {loss !== null && loss >= VALUE_LOSS_WARN ? <Notice tone="warning">{`You'd get about ${loss.toFixed(1)}% less value than you put in, after fees and price impact.`}</Notice> : null}
            <Text variant="caption" tone="tertiary">
              Routed by LI.FI through {q.toolName}. HENSENG checked this quote: it goes only to LI.FI's audited contract, from your address, for exactly the amount you entered. Signed on this device.
            </Text>
            <Field label="Password" value={password} onChangeText={(v) => { setPassword(v); setPasswordError(null); }} secureTextEntry autoCapitalize="none" placeholder="Your HENSENG password" error={passwordError} onSubmitEditing={() => void execute()} />
            {workError ? <Notice tone="negative">{workError}</Notice> : null}
            <Button label={needsApproval ? `Approve and ${mode}` : mode === "swap" ? "Swap" : "Bridge"} disabled={!password || lossBlocks} onPress={() => void execute()} />
          </>,
        )}
      </View>
    );
  }

  /* ───────── Form ───────── */
  const sideCard = (label: string, side: Side, isFrom: boolean) => {
    const net = networkFor(side.chainId)!;
    const bal = portfolio.balanceOf(side.token);
    return (
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="label" tone="secondary">{label}</Text>
          <Tap onPress={() => (isFrom || mode === "bridge" ? setPicker(isFrom ? "fromNet" : "toNet") : undefined)} disabled={!isFrom && mode === "swap"} accessibilityRole="button" accessibilityLabel={`${label} network: ${net.name}${!isFrom && mode === "swap" ? "" : ". Change"}`} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 30, borderRadius: radius.full, backgroundColor: theme.surface }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: net.color }} />
            <Text variant="caption">{net.name}</Text>
            {isFrom || mode === "bridge" ? <ChevronDown size={14} color={theme.textSecondary} /> : null}
          </Tap>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {isFrom ? (
            <TextInput
              value={amountInput}
              onChangeText={setAmountInput}
              placeholder="0"
              placeholderTextColor={theme.textTertiary}
              keyboardType="decimal-pad"
              accessibilityLabel="Amount to pay"
              style={{ flex: 1, minWidth: 0, fontSize: 30, fontWeight: "700", color: theme.text, outlineStyle: "none" } as never}
            />
          ) : (
            <Text style={{ flex: 1, fontSize: 30, fontWeight: "700", color: q ? theme.text : theme.textTertiary }} numberOfLines={1} accessibilityLabel="Estimated amount you get">
              {quote.status === "loading" ? "…" : q ? formatTokenAmount(BigInt(q.toAmount), side.token.decimals, 6) : "0"}
            </Text>
          )}
          <Tap onPress={() => setPicker(isFrom ? "fromToken" : "toToken")} accessibilityRole="button" accessibilityLabel={`${label} token: ${side.token.symbol}. Change`} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 6, paddingRight: 10, height: 42, borderRadius: radius.full, backgroundColor: theme.surface }}>
            <TokenIcon token={side.token} size={30} />
            <Text variant="bodyStrong">{side.token.symbol}</Text>
            <ChevronDown size={16} color={theme.textSecondary} />
          </Tap>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="caption" tone="secondary">
            {isFrom && q?.fromAmountUsd != null ? formatUsd(q.fromAmountUsd) : !isFrom && q?.toAmountUsd != null ? formatUsd(q.toAmountUsd) : " "}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text variant="caption" tone="secondary">Balance: {bal !== undefined ? formatTokenAmount(bal, side.token.decimals) : "—"}</Text>
            {isFrom ? (
              <Tap onPress={setMax} accessibilityRole="button" accessibilityLabel="Use maximum amount" style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: theme.accentSoft }}>
                <Text variant="label" tone="accent">Max</Text>
              </Tap>
            ) : null}
          </View>
        </View>
      </Card>
    );
  };

  const pickerChains = picker === "toNet" ? SWAP_CHAIN_IDS.filter((c) => c !== from.chainId) : SWAP_CHAIN_IDS;
  const pickerTokens = picker === "fromToken" ? tokensOn(from.chainId) : picker === "toToken" ? tokensOn(to.chainId).filter((t) => to.chainId !== from.chainId || tokenKey(t) !== tokenKey(from.token)) : [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {theme.mode === "dark" ? <ScreenGlow intensity={0.75} /> : null}
      {header(title)}
      {body(
        <>
          <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: theme.surface }}>
            {(["swap", "bridge"] as const).map((m) => (
              <Tap key={m} onPress={() => setMode(m)} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.sm, backgroundColor: mode === m ? theme.card : "transparent" }}>
                <Text variant="bodyStrong" style={{ color: mode === m ? theme.text : theme.textSecondary }}>{m === "swap" ? "Swap" : "Bridge"}</Text>
              </Tap>
            ))}
          </View>
          {sideCard("You pay", from, true)}
          <View style={{ alignItems: "center", marginVertical: -12, zIndex: 1 }}>
            <Tap onPress={flip} disabled={mode !== "swap"} accessibilityRole="button" accessibilityLabel="Switch tokens" style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, opacity: mode === "swap" ? 1 : 0.4 }}>
              <ArrowDownUp size={18} color={theme.text} />
            </Tap>
          </View>
          {sideCard("You get", to, false)}
          {amountError ? <Text tone="negative">{amountError}</Text> : null}
          {quote.status === "error" ? <Notice tone="negative">{quote.message}</Notice> : null}
          {quote.status === "loading" && !q ? (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", padding: 8 }}>
              <ActivityIndicator color={theme.accent} />
              <Text tone="secondary">Finding the best route…</Text>
            </View>
          ) : null}
          {details}
          {q ? <Text variant="caption" tone="tertiary" style={{ textAlign: "center" }}>{`Quote updates automatically · ${Math.max(0, Math.round((QUOTE_TTL_MS - (now - (quote.status === "ok" ? quote.at : now))) / 1000))} s`}</Text> : null}
          {loss !== null && loss >= VALUE_LOSS_WARN ? <Notice tone="warning">{`You'd get about ${loss.toFixed(1)}% less value than you put in. Try a smaller amount or another route.`}</Notice> : null}
          {loss !== null && loss >= VALUE_LOSS_CONFIRM ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Switch value={ackLoss} onValueChange={setAckLoss} accessibilityLabel={`I understand I'll lose about ${loss.toFixed(0)}% of the value`} trackColor={{ true: theme.negative, false: theme.surface }} thumbColor="#FFFFFF" />
              <Text variant="caption" style={{ flex: 1 }}>{`I understand I'll lose about ${loss.toFixed(0)}% of the value.`}</Text>
            </View>
          ) : null}
          <View style={{ gap: 8 }}>
            <Text variant="label" tone="secondary">Price protection (slippage)</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {SLIPPAGE_OPTIONS.map((s) => (
                <Tap key={s} onPress={() => setSlippage(s)} accessibilityRole="radio" accessibilityState={{ selected: slippage === s }} accessibilityLabel={`${s * 100}% slippage`} style={{ paddingHorizontal: 14, height: 34, justifyContent: "center", borderRadius: radius.full, backgroundColor: slippage === s ? theme.accentSoft : theme.surface, borderWidth: 1, borderColor: slippage === s ? theme.accent : "transparent" }}>
                  <Text variant="caption" style={{ color: slippage === s ? theme.accent : theme.textSecondary }}>{s * 100}%</Text>
                </Tap>
              ))}
            </View>
            <Text variant="caption" tone="tertiary">If the price moves more than this before it goes through, the {mode} is cancelled and only the network fee is spent.</Text>
          </View>
          <Button label={mode === "swap" ? "Review swap" : "Review bridge"} disabled={!q || !ready || lossBlocks || quote.status !== "ok"} onPress={() => void goReview()} />
          <Text variant="caption" tone="tertiary" style={{ textAlign: "center" }}>Ethereum, Base and Arbitrum. Quotes by LI.FI, which compares DEXs and bridges.</Text>
        </>,
      )}

      <Sheet visible={picker === "fromNet" || picker === "toNet"} onClose={() => setPicker(null)} title="Choose a network">
        {pickerChains.map((c) => {
          const n = networkFor(c)!;
          return (
            <Tap key={c} onPress={() => {
              const t = tokensOn(c);
              if (picker === "fromNet") {
                const tok = t.find((x) => x.symbol === from.token.symbol) ?? t[0]!;
                setFrom({ chainId: c, token: tok });
                if (mode === "swap") setTo({ chainId: c, token: t.find((x) => x.symbol === to.token.symbol && tokenKey(x) !== tokenKey(tok)) ?? t.find((x) => tokenKey(x) !== tokenKey(tok))! });
              } else setTo({ chainId: c, token: t.find((x) => x.symbol === to.token.symbol) ?? t[0]! });
              setPicker(null);
            }} accessibilityRole="button" accessibilityLabel={n.name} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: n.color }} />
              <Text variant="subheading" style={{ flex: 1 }}>{n.name}</Text>
            </Tap>
          );
        })}
      </Sheet>
      <Sheet visible={picker === "fromToken" || picker === "toToken"} onClose={() => setPicker(null)} title="Choose a token">
        {pickerTokens.map((t) => {
          const bal = portfolio.balanceOf(t);
          return (
            <Tap key={tokenKey(t)} onPress={() => {
              if (picker === "fromToken") {
                setFrom({ chainId: from.chainId, token: t });
                if (mode === "swap" && tokenKey(t) === tokenKey(to.token)) setTo({ chainId: to.chainId, token: from.token });
                // Bridges usually move the same token: follow it on the destination when it exists there.
                if (mode === "bridge") setTo({ chainId: to.chainId, token: tokensOn(to.chainId).find((x) => x.symbol === t.symbol) ?? to.token });
              } else setTo({ chainId: to.chainId, token: t });
              setAmountInput("");
              setPicker(null);
            }} accessibilityRole="button" accessibilityLabel={t.symbol} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
              <TokenIcon token={t} size={36} />
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{t.symbol}</Text>
                <Text variant="caption" tone="secondary">{t.name}</Text>
              </View>
              {bal !== undefined ? <Text variant="bodyStrong">{formatTokenAmount(bal, t.decimals)}</Text> : null}
            </Tap>
          );
        })}
        <Pill label="Verified tokens only, for your safety" />
      </Sheet>
    </View>
  );
}
