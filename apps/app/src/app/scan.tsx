import { findToken, parsePaymentText, TOKENS, type PaymentRequest } from "@henseng/wallet";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { CameraOff, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatUnits } from "viem";
import { Button, Field, IconButton, Text } from "../ui/primitives";
import { useTheme } from "../ui/theme";
import { radius } from "../ui/tokens";
import { deliverScanResult } from "../wallet/scan-bus";

/** Scans a wallet address or EIP-681 payment QR code and opens Send with it filled in. */
export default function ScanScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const handled = useRef(false);

  const finish = (r: PaymentRequest) => {
    if (from === "send" && deliverScanResult(r)) return router.back();
    // Opened from the wallet: go to Send with the request filled in.
    const params: Record<string, string> = { to: r.to };
    if (r.kind === "token") {
      const t = r.chainId ? findToken(r.chainId, r.token) : TOKENS.find((x) => x.address?.toLowerCase() === r.token.toLowerCase());
      if (!t) {
        handled.current = false;
        return setError("That code asks for a token HENSENG doesn't list yet, so it can't be sent from here.");
      }
      Object.assign(params, { chainId: String(t.chainId), token: t.address!, ...(r.amount ? { amount: formatUnits(r.amount, t.decimals) } : {}) });
    } else if (r.chainId) {
      Object.assign(params, { chainId: String(r.chainId), token: "native", ...(r.value ? { amount: formatUnits(r.value, 18) } : {}) });
    }
    router.replace({ pathname: "/send", params });
  };

  const handle = (text: string) => {
    if (handled.current) return;
    const r = parsePaymentText(text);
    if (!r.ok) return setError(r.reason);
    handled.current = true;
    finish(r.request);
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace("/wallet"));

  let camera;
  if (!permission) {
    camera = null;
  } else if (!permission.granted) {
    camera = (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
        <CameraOff size={40} color={theme.textSecondary} />
        <Text variant="subheading" style={{ textAlign: "center" }}>Camera access is needed to scan</Text>
        <Text tone="secondary" style={{ textAlign: "center" }}>HENSENG only uses the camera while this screen is open, and nothing is recorded.</Text>
        {permission.canAskAgain ? (
          <Button label="Allow camera" onPress={() => void requestPermission()} />
        ) : Platform.OS !== "web" ? (
          <Button label="Open settings" kind="secondary" onPress={() => void Linking.openSettings()} />
        ) : (
          <Text variant="caption" tone="tertiary" style={{ textAlign: "center" }}>Allow the camera in your browser's site settings, or paste the address below.</Text>
        )}
      </View>
    );
  } else {
    camera = (
      <View style={{ flex: 1, borderRadius: radius.xl, overflow: "hidden", backgroundColor: "#000" }}>
        <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={({ data }) => handle(data)} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 230, height: 230, borderRadius: 24, borderWidth: 3, borderColor: "rgba(255,255,255,0.9)" }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
        <View style={{ width: 44 }} />
        <Text variant="heading" style={{ flex: 1, textAlign: "center" }} accessibilityRole="header">Scan QR code</Text>
        <IconButton icon={X} label="Close" tone="plain" onPress={close} />
      </View>
      <View style={{ flex: 1, padding: 20, gap: 16, width: "100%", maxWidth: 560, alignSelf: "center" }}>
        <Text tone="secondary" style={{ textAlign: "center" }}>Point at a wallet address or payment QR code (Ethereum, Base or Arbitrum).</Text>
        {camera}
        {error ? <Text tone="negative" style={{ textAlign: "center" }}>{error}</Text> : null}
        <Field label="Or paste an address or payment link" value={manual} onChangeText={(v) => { setManual(v); setError(null); }} autoCapitalize="none" autoCorrect={false} placeholder="0x… or ethereum:…" onSubmitEditing={() => handle(manual)} />
        <Button label="Use this" kind="secondary" disabled={!manual.trim()} onPress={() => handle(manual)} />
      </View>
    </View>
  );
}
