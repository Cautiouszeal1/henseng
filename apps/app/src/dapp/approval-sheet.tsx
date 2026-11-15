import { findToken, formatTokenAmount } from "@henseng/wallet";
import { AlertTriangle, Globe, Link2, PenLine } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Sheet } from "../ui/overlays";
import { Button, Card, Field, Text } from "../ui/primitives";
import { useTheme } from "../ui/theme";
import { radius } from "../ui/tokens";
import {
  estimateFee,
  sendErrorMessage,
  type FeeEstimate,
} from "../wallet/send";
import { Notice } from "../wallet/send-ui";
import { networkInfo } from "../wallet/networks";
import { passwordErrorMessage } from "../wallet/unlock-guard";
import { useWallet } from "../wallet/wallet-context";
import type { Approval } from "./bridge";
import { formatEth } from "./bridge";

const host = (origin: string) => origin.replace(/^https:\/\//, "");
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** What the user is asked to approve, one request at a time. Resolves the request with true/false. */
export function ApprovalSheet({
  request,
  onDone,
}: {
  request: Approval | null;
  onDone: (ok: boolean) => void;
}) {
  const { theme } = useTheme();
  const { address, verifyPassword } = useWallet();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fee, setFee] = useState<FeeEstimate | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [showData, setShowData] = useState(false);

  useEffect(() => {
    setPassword("");
    setError(null);
    setBusy(false);
    setFee(null);
    setSimError(null);
    setShowData(false);
    if (request?.kind === "transaction" && address) {
      const { tx, chainId } = request;
      estimateFee(address, {
        chainId,
        to: tx.to,
        value: tx.value,
        data: tx.data,
      })
        .then(setFee)
        .catch((e) => setSimError(sendErrorMessage(e)));
    }
  }, [request, address]);

  const needsPassword =
    request?.kind === "transaction" ||
    (request?.kind === "typed" && request.permit);
  const close = () => onDone(false);
  const approve = async () => {
    if (needsPassword) {
      setBusy(true);
      try {
        if (!(await verifyPassword(password))) {
          setBusy(false);
          return setError("That password isn't right.");
        }
      } catch (e) {
        setBusy(false);
        return setError(
          passwordErrorMessage(e) ?? "Couldn't check your password.",
        );
      }
    }
    onDone(true);
  };

  if (!request) return null;
  const site = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: radius.lg,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Globe size={18} color={theme.accent} />
      <Text variant="subheading" style={{ flex: 1 }} numberOfLines={1}>
        {host(request.origin)}
      </Text>
    </View>
  );
  const net = (id: number) => networkInfo(id)?.name ?? `network ${id}`;
  const row = (label: string, value: string, mono = false) => (
    <View
      style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}
    >
      <Text tone="secondary">{label}</Text>
      <Text
        style={[
          { flexShrink: 1, textAlign: "right" },
          mono ? { fontFamily: "monospace" } : null,
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
  const passwordField = needsPassword ? (
    <Field
      label="Password"
      value={password}
      onChangeText={(v) => {
        setPassword(v);
        setError(null);
      }}
      secureTextEntry
      autoCapitalize="none"
      placeholder="Your HENSENG password"
      error={error}
      onSubmitEditing={() => void approve()}
    />
  ) : null;
  const actions = (label: string, disabled = false) => (
    <View style={{ gap: 10 }}>
      <Button
        label={label}
        loading={busy}
        disabled={disabled || (needsPassword && !password)}
        onPress={() => void approve()}
      />
      <Button label="Reject" kind="secondary" onPress={close} />
    </View>
  );

  const title =
    request.kind === "connect"
      ? "Connect to this site?"
      : request.kind === "switch"
        ? "Switch network?"
        : request.kind === "message"
          ? "Sign a message"
          : request.kind === "typed"
            ? request.permit
              ? "Allow token spending?"
              : "Sign data"
            : request.tx.approve
              ? "Allow token spending?"
              : "Confirm transaction";
  const renderBody = (): React.ReactNode => {
    switch (request.kind) {
      case "connect":
        return (
          <>
            {site}
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <Link2 size={18} color={theme.textSecondary} />
              <Text tone="secondary" style={{ flex: 1 }}>
                The site will see your address {address ? short(address) : ""}{" "}
                and balances, and can ask you to sign messages and transactions.
                It can't move funds without your approval each time.
              </Text>
            </View>
            <Notice tone="info">
              Only connect to sites you trust. Check the address above is the
              one you meant to visit.
            </Notice>
            {actions("Connect")}
          </>
        );
      case "switch":
        return (
          <>
            {site}
            <Text tone="secondary">
              The site wants to use {net(request.to)} instead of{" "}
              {net(request.from)}.
            </Text>
            {actions(`Switch to ${net(request.to)}`)}
          </>
        );
      case "message":
        return (
          <>
            {site}
            <Card style={{ padding: 14, maxHeight: 260 }}>
              <Text
                style={{
                  fontFamily:
                    request.text === request.raw &&
                    String(request.raw).startsWith("0x")
                      ? "monospace"
                      : undefined,
                }}
              >
                {request.text}
              </Text>
            </Card>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <PenLine size={18} color={theme.textSecondary} />
              <Text tone="secondary" variant="caption" style={{ flex: 1 }}>
                Signing a message doesn't cost anything or send a transaction.
                Sites use it to check you own this address.
              </Text>
            </View>
            {actions("Sign")}
          </>
        );
      case "typed":
        return (
          <>
            {site}
            {request.permit ? (
              <Notice tone="negative">{`This is a permit signature. It can let ${request.verifyingContract ? short(request.verifyingContract) : "a contract"} or an address it names spend your tokens without a further transaction. Only sign if you started this on a site you trust.`}</Notice>
            ) : null}
            {row("Network", net(request.chainId))}
            {request.domainName ? row("App", request.domainName) : null}
            {row("Type", request.primaryType)}
            {request.verifyingContract
              ? row("Contract", short(request.verifyingContract), true)
              : null}
            <Card style={{ padding: 12, maxHeight: 220 }}>
              <Text variant="caption" style={{ fontFamily: "monospace" }}>
                {JSON.stringify(
                  request.data,
                  (_k, v) => (typeof v === "bigint" ? v.toString() : v),
                  2,
                ).slice(0, 4000)}
              </Text>
            </Card>
            {passwordField}
            {actions("Sign")}
          </>
        );
      case "transaction": {
        const { tx, chainId } = request;
        const info = networkInfo(chainId);
        const token = tx.approve ? findToken(chainId, tx.to) : undefined;
        return (
          <>
            {site}
            {tx.approve ? (
              <Notice tone={tx.approve.unlimited ? "negative" : "warning"}>
                {`${short(tx.approve.spender)} will be able to spend ${tx.approve.unlimited ? "an unlimited amount of" : token ? formatTokenAmount(tx.approve.amount, token.decimals) : tx.approve.amount.toString()} ${token?.symbol ?? "this token"} from your wallet${tx.approve.unlimited ? ", now and later" : ""}. You can revoke this later with Revoke.cash.`}
              </Notice>
            ) : null}
            {row("Network", info?.name ?? String(chainId))}
            {row(
              tx.approve ? "Token" : "To",
              token ? `${token.symbol} (${short(tx.to)})` : short(tx.to),
              !token,
            )}
            {row("Sends", `${formatEth(tx.value)} ETH`)}
            {row(
              "Max network fee",
              fee
                ? `${formatEth(fee.maxFee).slice(0, 10)} ETH`
                : simError
                  ? "—"
                  : "Estimating…",
            )}
            {tx.data && !tx.approve ? (
              <View style={{ gap: 6 }}>
                <Text
                  tone="secondary"
                  variant="caption"
                  onPress={() => setShowData((v) => !v)}
                >
                  {showData
                    ? "Hide contract data"
                    : "This calls a contract. Show data"}
                </Text>
                {showData ? (
                  <Card style={{ padding: 10 }}>
                    <Text
                      variant="caption"
                      style={{ fontFamily: "monospace" }}
                      selectable
                    >
                      {tx.data.slice(0, 2000)}
                    </Text>
                  </Card>
                ) : null}
              </View>
            ) : null}
            {simError ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <AlertTriangle size={18} color={theme.negative} />
                <Text
                  tone="negative"
                  style={{ flex: 1 }}
                >{`This transaction would fail: ${simError}`}</Text>
              </View>
            ) : null}
            <Text variant="caption" tone="tertiary">
              Signed on this device. Transactions can't be reversed once
              confirmed.
            </Text>
            {passwordField}
            {actions(
              tx.approve ? "Allow" : "Confirm",
              Boolean(simError) || !fee,
            )}
          </>
        );
      }
    }
  };
  return (
    <Sheet visible onClose={close} title={title}>
      {renderBody()}
    </Sheet>
  );
}
