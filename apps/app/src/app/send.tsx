import { findToken, formatTokenAmount, parseAmountInput, parsePaymentText, TOKENS, tokenKey, type PaymentRequest, type TokenInfo } from "@henseng/wallet";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, ClipboardPaste, ExternalLink, Info, ScanLine, X, XCircle } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { formatUnits } from "viem";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sheet } from "../ui/overlays";
import { Button, Card, Field, IconButton, Pill, Tap, Text } from "../ui/primitives";
import { useTheme } from "../ui/theme";
import { radius } from "../ui/tokens";
import { useActivity } from "../wallet/activity";
import { explorerTx, networkFor, publicClient } from "../wallet/networks";
import { useResolveRecipient } from "../wallet/resolve-recipient";
import { onScanResult } from "../wallet/scan-bus";
import { buildTransfer, estimateFee, sendErrorMessage, type FeeEstimate, type TxRequest } from "../wallet/send";
import { TokenIcon } from "../wallet/token-icon";
import { formatUsd, usePortfolio } from "../wallet/use-portfolio";
import { useWallet } from "../wallet/wallet-context";

type Review = {
  token: TokenInfo;
  to: `0x${string}`;
  toLabel: string;
  amount: bigint;
  tx: TxRequest;
  fee: FeeEstimate;
  isContract: boolean;
  firstTime: boolean;
};

/** "0x1234 5678 …" groups so the whole address is easy to check against the source. */
function AddressBlock({ address }: { address: string }) {
  const { theme } = useTheme();
  const body = address.slice(2);
  const groups = body.match(/.{1,4}/g) ?? [];
  return (
    <Text variant="mono" selectable accessibilityLabel={address} style={{ lineHeight: 22 }}>
      <Text variant="mono" style={{ color: theme.accent }}>0x{groups[0]}</Text>
      {" "}{groups.slice(1, -1).join(" ")}{" "}
      <Text variant="mono" style={{ color: theme.accent }}>{groups.at(-1)}</Text>
    </Text>
  );
}

function Notice({ tone, children }: { tone: "warning" | "info" | "negative"; children: string }) {
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

export default function SendScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ to?: string; chainId?: string; token?: string; amount?: string }>();
  const { address, verifyPassword, sendTransaction } = useWallet();
  const portfolio = usePortfolio();
  const activity = useActivity();
  const resolve = useResolveRecipient();

  const [step, setStep] = useState<"form" | "review" | "sent">("form");
  const [tokenK, setTokenK] = useState<string | null>(null);
  const [toInput, setToInput] = useState(params.to ?? "");
  const [amountInput, setAmountInput] = useState("");
  const [toError, setToError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [hash, setHash] = useState<`0x${string}` | null>(null);

  // Assets you can send: everything with a balance, plus the chosen one.
  const sendable = portfolio.holdings.filter((h) => h.balance > 0n);
  const token: TokenInfo | undefined = useMemo(() => TOKENS.find((t) => tokenKey(t) === tokenK) ?? sendable[0]?.token, [tokenK, sendable]);
  const network = token ? networkFor(token.chainId) : undefined;
  const balance = token ? portfolio.balanceOf(token) : undefined;
  const price = token ? portfolio.priceOf(token) : undefined;

  // Apply a payment link (from the URL or the scanner).
  const applyRequest = (r: PaymentRequest) => {
    setToError(null);
    setFormError(null);
    if (r.chainId && !networkFor(r.chainId)) {
      setFormError(`That payment link is for a network HENSENG doesn't support (chain ${r.chainId}).`);
      return;
    }
    if (r.kind === "token") {
      const t = r.chainId ? findToken(r.chainId, r.token) : TOKENS.find((x) => x.address?.toLowerCase() === r.token.toLowerCase());
      if (!t) {
        setFormError("That payment link asks for a token HENSENG doesn't list yet, so it can't be sent from here.");
        return;
      }
      setTokenK(tokenKey(t));
      setToInput(r.to);
      if (r.amount) setAmountInput(formatUnits(r.amount, t.decimals));
    } else {
      setToInput(r.to);
      if (r.chainId) setTokenK(tokenKey({ chainId: r.chainId, address: null }));
      if (r.value) setAmountInput(formatUnits(r.value, 18));
    }
  };

  useEffect(() => {
    if (params.chainId && params.token !== undefined) {
      const t = findToken(Number(params.chainId), params.token === "native" ? null : params.token);
      if (t) setTokenK(tokenKey(t));
    }
    if (params.amount) setAmountInput(params.amount);
    return onScanResult(applyRequest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paste = async () => {
    const v = (await Clipboard.getStringAsync()).trim();
    if (!v.toLowerCase().startsWith("ethereum:")) return setToInput(v);
    const r = parsePaymentText(v);
    if (r.ok) applyRequest(r.request);
    else setToError(r.reason);
  };

  const usdHint = (() => {
    if (!token || !price) return token && network?.testnet ? "Testnet tokens have no value." : undefined;
    const r = parseAmountInput(amountInput, token.decimals);
    return r.ok ? `≈ ${formatUsd(Number(formatUnits(r.value, token.decimals)) * price.usd)}${price.stale ? " (price may be out of date)" : ""}` : undefined;
  })();

  const setMax = async () => {
    if (!token || balance === undefined || !address) return;
    setAmountError(null);
    if (token.address) return setAmountInput(formatUnits(balance, token.decimals));
    // For ETH, leave enough for the network fee.
    try {
      const fee = await estimateFee(address, { chainId: token.chainId, to: address, value: 0n });
      const max = balance - fee.maxFee;
      if (max <= 0n) return setAmountError("Your whole balance would go on the network fee.");
      setAmountInput(formatUnits(max, 18));
    } catch {
      setAmountError("Couldn't estimate the network fee. Enter an amount instead.");
    }
  };

  const continueToReview = async () => {
    if (!token || !address || balance === undefined) return;
    setToError(null);
    setAmountError(null);
    setFormError(null);
    const amt = parseAmountInput(amountInput, token.decimals);
    if (!amt.ok) return setAmountError(amt.reason);
    if (amt.value > balance) return setAmountError(`You have ${formatTokenAmount(balance, token.decimals)} ${token.symbol}.`);
    setChecking(true);
    try {
      const r = await resolve(toInput);
      if ("error" in r) return setToError(r.error);
      const to = r.address;
      if (to.toLowerCase() === address.toLowerCase()) return setToError("That's your own address.");
      if (TOKENS.some((t) => t.address?.toLowerCase() === to.toLowerCase())) {
        return setToError("That's a token contract, not a wallet. Tokens sent there are lost.");
      }
      const tx = buildTransfer(token, to, amt.value);
      const client = publicClient(token.chainId);
      let fee: FeeEstimate;
      try {
        fee = await estimateFee(address, tx);
      } catch (e) {
        return setFormError(sendErrorMessage(e));
      }
      const eth = portfolio.balanceOf(TOKENS.find((t) => t.chainId === token.chainId && !t.address)!) ?? 0n;
      const needEth = fee.maxFee + (token.address ? 0n : amt.value);
      if (needEth > eth) {
        return setFormError(
          token.address
            ? `You need up to ${formatTokenAmount(fee.maxFee, 18)} ETH on ${network?.name} to pay the network fee, and you have ${formatTokenAmount(eth, 18)}.`
            : `That amount plus the network fee (up to ${formatTokenAmount(fee.maxFee, 18)} ETH) is more than you have. Try Max.`,
        );
      }
      const code = await client.getCode({ address: to }).catch(() => undefined);
      setReview({
        token,
        to,
        toLabel: r.label,
        amount: amt.value,
        tx,
        fee,
        isContract: !!code && code !== "0x",
        firstTime: !activity.knownRecipients.has(to.toLowerCase()),
      });
      setPassword("");
      setPasswordError(null);
      setSendError(null);
      setStep("review");
    } finally {
      setChecking(false);
    }
  };

  const confirmSend = async () => {
    if (!review) return;
    setSending(true);
    setPasswordError(null);
    setSendError(null);
    try {
      if (!(await verifyPassword(password))) return setPasswordError("That password isn't right.");
      const h = await sendTransaction({ ...review.tx, gas: review.fee.gas });
      activity.add({
        hash: h,
        chainId: review.token.chainId,
        kind: "send",
        symbol: review.token.symbol,
        decimals: review.token.decimals,
        amount: review.amount.toString(),
        to: review.to,
        toLabel: review.toLabel !== review.to ? review.toLabel : undefined,
        maxFee: review.fee.maxFee.toString(),
      });
      setHash(h);
      setStep("sent");
    } catch (e) {
      setSendError(sendErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace("/wallet"));
  const header = (title: string, onBack?: () => void) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: insets.top + 8, paddingBottom: 8 }}>
      {onBack ? <IconButton icon={ArrowLeft} label="Back" tone="plain" onPress={onBack} /> : <View style={{ width: 44 }} />}
      <Text variant="heading" style={{ flex: 1, textAlign: "center" }} accessibilityRole="header">{title}</Text>
      <IconButton icon={X} label="Close" tone="plain" onPress={close} />
    </View>
  );

  const body = (children: React.ReactNode) => (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 32, width: "100%", maxWidth: 560, alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  /* ───────── Sent ───────── */
  if (step === "sent" && review && hash) {
    const item = activity.get(hash);
    const status = item?.status ?? "pending";
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {header("Sent")}
        {body(
          <>
            <View style={{ alignItems: "center", gap: 14, paddingVertical: 20 }}>
              <View style={{ width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", backgroundColor: (status === "failed" ? theme.negative : status === "confirmed" ? theme.positive : theme.accent) + "22" }}>
                {status === "pending" ? <ActivityIndicator color={theme.accent} size="large" /> : status === "confirmed" ? <Check size={40} color={theme.positive} /> : <XCircle size={40} color={theme.negative} />}
              </View>
              <Text variant="title" style={{ textAlign: "center" }}>
                {status === "pending" ? "Sending…" : status === "confirmed" ? "Sent" : "Transaction failed"}
              </Text>
              <Text tone="secondary" style={{ textAlign: "center" }}>
                {status === "pending"
                  ? `${formatTokenAmount(review.amount, review.token.decimals)} ${review.token.symbol} is on its way. ${networkFor(review.token.chainId)?.name} usually confirms within a minute.`
                  : status === "confirmed"
                    ? `${formatTokenAmount(review.amount, review.token.decimals)} ${review.token.symbol} arrived at ${review.toLabel.startsWith("0x") ? `${review.to.slice(0, 6)}…${review.to.slice(-4)}` : review.toLabel}.`
                    : "The network rejected it. The amount stayed in your wallet; only the network fee was spent."}
              </Text>
            </View>
            <Button label="View on explorer" icon={ExternalLink} kind="secondary" onPress={() => void WebBrowser.openBrowserAsync(explorerTx(review.token.chainId, hash))} />
            <Button label="Done" onPress={close} />
            <Text variant="caption" tone="tertiary" style={{ textAlign: "center" }}>You can leave this screen. Progress also shows in Wallet → Activity.</Text>
          </>,
        )}
      </View>
    );
  }

  /* ───────── Review ───────── */
  if (step === "review" && review) {
    const rNet = networkFor(review.token.chainId)!;
    const p = portfolio.priceOf(review.token);
    const ethPrice = portfolio.priceOf(TOKENS.find((t) => t.chainId === review.token.chainId && !t.address)!);
    const amountUsd = p ? Number(formatUnits(review.amount, review.token.decimals)) * p.usd : undefined;
    const feeUsd = ethPrice ? Number(formatUnits(review.fee.maxFee, 18)) * ethPrice.usd : undefined;
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {header("Review", () => setStep("form"))}
        {body(
          <>
            <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
              <TokenIcon symbol={review.token.symbol} network={rNet} size={56} />
              <Text variant="display" style={{ textAlign: "center" }}>{formatTokenAmount(review.amount, review.token.decimals, 8)} {review.token.symbol}</Text>
              {amountUsd !== undefined ? <Text tone="secondary">≈ {formatUsd(amountUsd)}</Text> : null}
              {rNet.testnet ? <Pill label="Testnet · no real value" tone="warning" /> : null}
            </View>
            <Card style={{ gap: 14 }}>
              <View style={{ gap: 6 }}>
                <Text variant="label" tone="secondary">To</Text>
                {review.toLabel !== review.to ? <Text variant="subheading">{review.toLabel}</Text> : null}
                <AddressBlock address={review.to} />
              </View>
              <View style={{ height: 1, backgroundColor: theme.border }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text tone="secondary">Network</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: rNet.color }} />
                  <Text variant="bodyStrong">{rNet.name}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text tone="secondary">Network fee</Text>
                <Text variant="bodyStrong" style={{ textAlign: "right", flexShrink: 1 }}>
                  Up to {formatTokenAmount(review.fee.maxFee, 18, 8)} ETH{feeUsd !== undefined ? ` (${formatUsd(feeUsd)})` : ""}
                </Text>
              </View>
              {!review.token.address ? (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text tone="secondary">Total, at most</Text>
                  <Text variant="bodyStrong">{formatTokenAmount(review.amount + review.fee.maxFee, 18, 8)} ETH</Text>
                </View>
              ) : null}
            </Card>
            {review.isContract ? (
              <Notice tone="warning">{`This address is a smart contract. Only continue if you know it accepts ${review.token.symbol} on ${rNet.name}; tokens sent to the wrong contract are usually lost for good.`}</Notice>
            ) : null}
            {review.firstTime ? (
              <Notice tone="info">You haven't sent to this address before. Check the first and last characters against where you got it. Scammers use look-alike addresses.</Notice>
            ) : null}
            <Text variant="caption" tone="tertiary">Transfers on {rNet.name} can't be reversed once confirmed. HENSENG never holds your funds; this is signed on this device.</Text>
            <Field label="Password" value={password} onChangeText={(v) => { setPassword(v); setPasswordError(null); }} secureTextEntry autoCapitalize="none" placeholder="Your HENSENG password" error={passwordError} onSubmitEditing={() => void confirmSend()} />
            {sendError ? <Notice tone="negative">{sendError}</Notice> : null}
            <Button label={`Send ${formatTokenAmount(review.amount, review.token.decimals)} ${review.token.symbol}`} loading={sending} disabled={!password} onPress={() => void confirmSend()} />
          </>,
        )}
      </View>
    );
  }

  /* ───────── Form ───────── */
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {header("Send")}
      {body(
        portfolio.loading && !sendable.length ? (
          <View style={{ padding: 40, alignItems: "center", gap: 12 }}>
            <ActivityIndicator color={theme.accent} />
            <Text tone="secondary">Reading your balances…</Text>
          </View>
        ) : !token ? (
          <Card style={{ gap: 10 }}>
            <Text variant="subheading">Nothing to send yet</Text>
            <Text tone="secondary">
              {portfolio.failedNetworks.length ? "Some networks couldn't be reached, so balances may be missing. Go back and tap Refresh." : "Your wallet has no balance on the supported networks. Use Receive to add funds."}
            </Text>
            {!portfolio.includeTestnets ? <Button label="Show testnet balances" kind="secondary" onPress={() => portfolio.setIncludeTestnets(true)} /> : null}
          </Card>
        ) : (
          <>
            {formError ? <Notice tone="negative">{formError}</Notice> : null}
            <View style={{ gap: 8 }}>
              <Text variant="label" tone="secondary">Asset</Text>
              <Tap onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel={`Asset: ${token.symbol} on ${network?.name}. Change`} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                <TokenIcon symbol={token.symbol} network={network} size={38} />
                <View style={{ flex: 1 }}>
                  <Text variant="subheading">{token.symbol} <Text tone="secondary">on {network?.name}</Text></Text>
                  <Text variant="caption" tone="secondary">Balance: {balance !== undefined ? formatTokenAmount(balance, token.decimals) : "—"} {token.symbol}</Text>
                </View>
                <ChevronDown size={18} color={theme.textSecondary} />
              </Tap>
            </View>
            <View style={{ gap: 8 }}>
              <Field
                label="To"
                value={toInput}
                onChangeText={(v) => { setToInput(v); setToError(null); }}
                placeholder="0x… address, name.eth or @username"
                autoCapitalize="none"
                autoCorrect={false}
                error={toError}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Tap onPress={() => router.push({ pathname: "/scan", params: { from: "send" } })} accessibilityRole="button" accessibilityLabel="Scan QR code" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 34, borderRadius: radius.full, backgroundColor: theme.accentSoft }}>
                  <ScanLine size={15} color={theme.accent} />
                  <Text variant="caption" tone="accent">Scan</Text>
                </Tap>
                <Tap onPress={() => void paste()} accessibilityRole="button" accessibilityLabel="Paste" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 34, borderRadius: radius.full, backgroundColor: theme.surface }}>
                  <ClipboardPaste size={15} color={theme.textSecondary} />
                  <Text variant="caption" tone="secondary">Paste</Text>
                </Tap>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Field
                label="Amount"
                value={amountInput}
                onChangeText={(v) => { setAmountInput(v); setAmountError(null); }}
                placeholder="0.00"
                keyboardType="decimal-pad"
                error={amountError}
                hint={usdHint}
              />
              <Tap onPress={() => void setMax()} accessibilityRole="button" accessibilityLabel="Use maximum amount" style={{ alignSelf: "flex-start", paddingHorizontal: 12, height: 34, justifyContent: "center", borderRadius: radius.full, backgroundColor: theme.surface }}>
                <Text variant="caption" tone="accent">Max</Text>
              </Tap>
            </View>
            <Button label="Review" loading={checking} disabled={!toInput.trim() || !amountInput.trim()} onPress={() => void continueToReview()} />
            <Text variant="caption" tone="tertiary" style={{ textAlign: "center" }}>Nothing is sent until you confirm on the next screen.</Text>
          </>
        ),
      )}

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Choose an asset">
        {sendable.map((h) => (
          <Tap key={h.key} onPress={() => { setTokenK(h.key); setPicking(false); setAmountInput(""); setFormError(null); }} accessibilityRole="button" accessibilityLabel={`${h.token.symbol} on ${h.network.name}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
            <TokenIcon symbol={h.token.symbol} network={h.network} size={38} />
            <View style={{ flex: 1 }}>
              <Text variant="subheading">{h.token.symbol}</Text>
              <Text variant="caption" tone="secondary">{h.network.name}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text variant="bodyStrong">{formatTokenAmount(h.balance, h.token.decimals)}</Text>
              {h.usd !== undefined ? <Text variant="caption" tone="secondary">{formatUsd(h.usd)}</Text> : null}
            </View>
            {h.key === (token ? tokenKey(token) : "") ? <Check size={18} color={theme.accent} /> : null}
          </Tap>
        ))}
      </Sheet>
    </View>
  );
}
