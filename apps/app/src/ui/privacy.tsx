import * as ScreenCapture from "expo-screen-capture";
import { useEffect, useState } from "react";
import { AppState, Platform, View } from "react-native";
import { LogoMark } from "./logo";

/**
 * While mounted, blocks screenshots and screen recording of the current screen on iOS and
 * Android (Android shows a blank image; iOS hides recordings). Used wherever a recovery phrase
 * is visible or typed. No effect on web.
 */
export function NoScreenCapture() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const key = `henseng-secret-${Math.random().toString(36).slice(2)}`;
    void ScreenCapture.preventScreenCaptureAsync(key).catch(() => undefined);
    return () => void ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined);
  }, []);
  return null;
}

/**
 * Covers the app with a plain branded screen whenever it leaves the foreground, so the phone's
 * app switcher never shows balances, chats or a recovery phrase.
 */
export function AppSwitcherShield() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (s) => setHidden(s !== "active"));
    return () => sub.remove();
  }, []);
  if (!hidden) return null;
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#101014", alignItems: "center", justifyContent: "center", zIndex: 9999 }} accessibilityElementsHidden>
      <LogoMark size={64} />
    </View>
  );
}
