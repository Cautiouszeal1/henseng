import {
  compileMessage, createAtaIdempotentInstruction, formatTokenAmount, isOnCurve, isSolanaAddress, LAMPORTS_PER_SIGNATURE, parseAmountInput,
  RENT_EXEMPT_MIN_LAMPORTS, associatedTokenAddress, solTransferInstruction, tokenKey, transferCheckedInstruction,
} from "@henseng/wallet";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Check, ChevronDown, ClipboardPaste, ExternalLink, X, XCircle } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatUnits } from "viem";
import { Sheet } from "../ui/overlays";
import { Button, Card, Field, IconButton, Pill, Tap, Text } from "../ui/primitives";
import { useTheme } from "../ui/theme";
import { radius } from "../ui/tokens";
import { useActivity } from "../wallet/activity";
import { explorerTx, networkInfo } from "../wallet/networks";
import { AddressBlock, Notice } from "../wallet/send-ui";
import { accountExists, latestBlockhash, rentExemptMinimum, sendRawSolana } from "../wallet/solana-rpc";
import { TokenIcon } from "../wallet/token-icon";
import { formatUsd, usePortfolio, type WalletToken } from "../wallet/use-portfolio";
import { useWallet } from "../wallet/wallet-context";

const TOKEN_ACCOUNT_BYTES = 165;

type Review = {
  token: WalletToken;
  to: string;
  amount: bigint;
  /** Lamports: signature fee plus rent for the recipient's token account if it must be created */
  fee: bigint;
  createsTokenAccount: boolean;
  offCurve: boolean;
  firstTime: boolean;
};

function solanaError(e: unknown): string {
  const m = e instanceof Error ? `${e.message} ${((e as { logs?: string[] }).logs ?? []).join(" ")}` : String(e);
  if (/insufficient (funds|lamports)|0x1\b/i.test(m)) return "Not enough SOL to cover the amount and the network fee.";
  if (/blockhash not found|block height exceeded/i.test(m)) return "The network moved on before this was sent. Try again.";
  if (/fetch|network|abort|Failed to fetch|returned 5/i.test(m)) return "Couldn't reach Solana. Check your connection and try again.";
  return "The transaction couldn't be sent. Nothing left your wallet.";
}

export default function SendSolanaScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ chainId?: string; token?: string }>();
  const { solanaAddress, verifyPassword, signSolana } = useWallet();
  const portfolio = usePortfolio();
  const activity = useActivity();

  const [step, setStep] = useState<"form" | "review" | "sent">("form");
  const [tokenK, setTokenK] = useState<string | null>(params.chainId ? tokenKey({ chainId: Number(params.chainId), address: params.token && params.token !== "native" ? params.token : null }) : null);
  const [toInput, setToInput] = useState("");
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
  const [sig, setSig] = useState<string | null>(null);

  const sendable = portfolio.holdings.filter((h) => h.balance > 0n && h.network.kind === "solana");
  const token = useMemo(() => portfolio.allTokens.find((t) => tokenKey(t) === tokenK) ?? sendable[0]?.token, [tokenK, sendable, portfolio.allTokens]);
  const network = token ? networkInfo(token.chainId) : undefined;
  const balance = token ? portfolio.balanceOf(token) : undefined;
  const solBalance = token ? portfolio.balanceOf({ chainId: token.chainId, address: null }) ?? 0n : 0n;
  const price = token ? portfolio.priceOf(token) : undefined;
  const solPrice = token ? portfolio.priceOf({ chainId: token.chainId, address: null, symbol: "SOL", name: "", decimals: 9, priceId: network?.testnet ? undefined : "solana" }) : undefined;

  const usdHint = (() => {
    if (!token || !price) return token && network?.testnet ? "Devnet tokens have no value." : undefined;
    const r = parseAmountInput(amountInput, token.decimals);
    return r.ok ? `≈ ${formatUsd(Number(formatUnits(r.value, token.decimals)) * price.usd)}` : undefined;
  })();

  const setMax = () => {
    if (!token || balance === undefined) return;
    setAmountError(null);
    if (token.address) return setAmountInput(formatUnits(balance, token.decimals));
    const max = balance - LAMPORTS_PER_SIGNATURE;
    if (max <= 0n) return setAmountError("Your whole balance would go on the network fee.");
    setAmountInput(formatUnits(max, 9));
  };

  const continueToReview = async () => {
    if (!token || !solanaAddress || balance === undefined) return;
    setToError(null);
    setAmountError(null);
    setFormError(null);
    const to = toInput.trim();
    if (to.startsWith("0x")) return setToError("That's an Ethereum-style address. Solana addresses look like 7xKX…9pQ (letters and numbers, no 0x).");
    if (!isSolanaAddress(to)) return setToError("That isn't a valid Solana address.");
    if (to === solanaAddress) return setToError("That's your own address.");
    if (portfolio.allTokens.some((t) => t.address === to)) return setToError("That's a token mint, not a wallet. Tokens sent there are lost.");
    const amt = parseAmountInput(amountInput, token.decimals);
    if (!amt.ok) return setAmountError(amt.reason);
    if (amt.value > balance) return setAmountError(`You have ${formatTokenAmount(balance, token.decimals)} ${token.symbol}.`);
    setChecking(true);
    try {
      const offCurve = !isOnCurve(to);
      let fee = LAMPORTS_PER_SIGNATURE;
      let createsTokenAccount = false;
      if (token.address) {
        createsTokenAccount = !(await accountExists(token.chainId, associatedTokenAddress(to, token.address)));
        if (createsTokenAccount) fee += await rentExemptMinimum(token.chainId, TOKEN_ACCOUNT_BYTES);
      } else if (amt.value < RENT_EXEMPT_MIN_LAMPORTS && !(await accountExists(token.chainId, to))) {
        return setAmountError(`This address is new on Solana, so it must receive at least ${formatUnits(RENT_EXEMPT_MIN_LAMPORTS, 9)} SOL.`);
      }
      const needSol = fee + (token.address ? 0n : amt.value);
      if (needSol > solBalance) {
        return setFormError(
          token.address
            ? `You need ${formatUnits(fee, 9)} SOL for the network fee${createsTokenAccount ? " and to open the recipient's USDC account" : ""}, and you have ${formatTokenAmount(solBalance, 9)}.`
            : `That amount plus the network fee (${formatUnits(fee, 9)} SOL) is more than you have. Try Max.`,
        );
      }
      setReview({ token, to, amount: amt.value, fee, createsTokenAccount, offCurve, firstTime: !activity.knownRecipients.has(to) });
      setPassword("");
      setPasswordError(null);
      setSendError(null);
      setStep("review");
    } catch (e) {
      setFormError(solanaError(e));
    } finally {
      setChecking(false);
    }
  };

  const confirmSend = async () => {
    if (!review || !solanaAddress) return;
    setSending(true);
    setPasswordError(null);
    setSendError(null);
    try {
      if (!(await verifyPassword(password))) return setPasswordError("That password isn't right.");
      const { token: t, to, amount } = review;
      const instructions = t.address
        ? [...(review.createsTokenAccount ? [createAtaIdempotentInstruction(solanaAddress, to, t.address)] : []), transferCheckedInstruction(solanaAddress, t.address, to, amount, t.decimals)]
        : [solTransferInstruction(solanaAddress, to, amount)];
      const message = compileMessage(solanaAddress, await latestBlockhash(t.chainId), instructions);
      const { wire, signature } = signSolana(message);
      await sendRawSolana(t.chainId, wire);
      activity.add({ hash: signature, chainId: t.chainId, kind: "send", symbol: t.symbol, decimals: t.decimals, amount: amount.toString(), to, maxFee: review.fee.toString() });
      setSig(signature);
      setStep("sent");
    } catch (e) {
      setSendError(solanaError(e));
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

  if (step === "sent" && review && sig) {
    const status = activity.get(sig)?.status ?? "pending";
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {header("Sent")}
        {body(
          <>
            <View style={{ alignItems: "center", gap: 14, paddingVertical: 20 }}>
              <View style={{ width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", backgroundColor: (status === "failed" ? theme.negative : status === "confirmed" ? theme.positive : theme.accent) + "22" }}>
                {status === "pending" ? <ActivityIndicator color={theme.accent} size="large" /> : status === "confirmed" ? <Check size={40} color={theme.positive} /> : <XCircle size={40} color={theme.negative} />}
              </View>
              <Text variant="title">{status === "pending" ? "Sending…" : status === "confirmed" ? "Sent" : "Transaction failed"}</Text>
              <Text tone="secondary" style={{ textAlign: "center" }}>
                {status === "pending"
                  ? `${formatTokenAmount(review.amount, review.token.decimals)} ${review.token.symbol} is on its way. Solana usually confirms in a few seconds.`
                  : status === "confirmed"
                    ? `${formatTokenAmount(review.amount, review.token.decimals)} ${review.token.symbol} arrived at ${review.to.slice(0, 4)}…${review.to.slice(-4)}.`
                    : "The network rejected it. The amount stayed in your wallet; only the network fee was spent."}
              </Text>
            </View>
            <Button label="View on explorer" icon={ExternalLink} kind="secondary" onPress={() => void WebBrowser.openBrowserAsync(explorerTx(review.token.chainId, sig))} />
            <Button label="Done" onPress={close} />
          </>,
        )}
      </View>
    );
  }

  if (step === "review" && review) {
    const rNet = networkInfo(review.token.chainId)!;
    const p = portfolio.priceOf(review.token);
    const amountUsd = p ? Number(formatUnits(review.amount, review.token.decimals)) * p.usd : undefined;
    const feeUsd = solPrice ? Number(formatUnits(review.fee, 9)) * solPrice.usd : undefined;
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {header("Review", () => setStep("form"))}
        {body(
          <>
            <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
              <TokenIcon symbol={review.token.symbol} network={rNet} size={56} />
              <Text variant="display" style={{ textAlign: "center" }}>{formatTokenAmount(review.amount, review.token.decimals, 9)} {review.token.symbol}</Text>
              {amountUsd !== undefined ? <Text tone="secondary">≈ {formatUsd(amountUsd)}</Text> : null}
              {rNet.testnet ? <Pill label="Devnet · no real value" tone="warning" /> : null}
            </View>
            <Card style={{ gap: 14 }}>
              <View style={{ gap: 6 }}>
                <Text variant="label" tone="secondary">To</Text>
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
                <Text tone="secondary">{review.createsTokenAccount ? "Fee + account setup" : "Network fee"}</Text>
                <Text variant="bodyStrong" style={{ textAlign: "right", flexShrink: 1 }}>{formatUnits(review.fee, 9)} SOL{feeUsd !== undefined ? ` (${formatUsd(feeUsd)})` : ""}</Text>
              </View>
            </Card>
            {review.createsTokenAccount ? (
              <Notice tone="info">{`The recipient doesn't have a ${review.token.symbol} account yet, so this send opens one for them. That costs a one-time ${formatUnits(review.fee - LAMPORTS_PER_SIGNATURE, 9)} SOL, included above.`}</Notice>
            ) : null}
            {review.offCurve ? <Notice tone="warning">This address belongs to a program, not a personal wallet. Only continue if you're sure it's meant to receive this.</Notice> : null}
            {review.firstTime ? <Notice tone="info">You haven't sent to this address before. Check the first and last characters against where you got it. Scammers use look-alike addresses.</Notice> : null}
            <Text variant="caption" tone="tertiary">Solana transfers can't be reversed. HENSENG never holds your funds; this is signed on this device.</Text>
            <Field label="Password" value={password} onChangeText={(v) => { setPassword(v); setPasswordError(null); }} secureTextEntry autoCapitalize="none" placeholder="Your HENSENG password" error={passwordError} onSubmitEditing={() => void confirmSend()} />
            {sendError ? <Notice tone="negative">{sendError}</Notice> : null}
            <Button label={`Send ${formatTokenAmount(review.amount, review.token.decimals)} ${review.token.symbol}`} loading={sending} disabled={!password} onPress={() => void confirmSend()} />
          </>,
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {header("Send on Solana")}
      {body(
        !token ? (
          <Card style={{ gap: 10 }}>
            <Text variant="subheading">Nothing to send on Solana yet</Text>
            <Text tone="secondary">Your Solana address has no SOL or USDC. Use Receive → Solana to add funds.</Text>
            {!portfolio.includeTestnets ? <Button label="Show devnet balances" kind="secondary" onPress={() => portfolio.setIncludeTestnets(true)} /> : null}
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
              <Field label="To" value={toInput} onChangeText={(v) => { setToInput(v); setToError(null); }} placeholder="Solana address" autoCapitalize="none" autoCorrect={false} error={toError} />
              <Tap onPress={() => void Clipboard.getStringAsync().then((v) => setToInput(v.trim()))} accessibilityRole="button" accessibilityLabel="Paste" style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 34, borderRadius: radius.full, backgroundColor: theme.surface }}>
                <ClipboardPaste size={15} color={theme.textSecondary} />
                <Text variant="caption" tone="secondary">Paste</Text>
              </Tap>
            </View>
            <View style={{ gap: 8 }}>
              <Field label="Amount" value={amountInput} onChangeText={(v) => { setAmountInput(v); setAmountError(null); }} placeholder="0.00" keyboardType="decimal-pad" error={amountError} hint={usdHint} />
              <Tap onPress={setMax} accessibilityRole="button" accessibilityLabel="Use maximum amount" style={{ alignSelf: "flex-start", paddingHorizontal: 12, height: 34, justifyContent: "center", borderRadius: radius.full, backgroundColor: theme.surface }}>
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
            <Text variant="bodyStrong">{formatTokenAmount(h.balance, h.token.decimals)}</Text>
          </Tap>
        ))}
      </Sheet>
    </View>
  );
}
