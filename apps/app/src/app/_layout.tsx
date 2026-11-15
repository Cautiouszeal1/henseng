import "../lib/polyfills";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ApiProvider } from "../api/api-context";
import { MessagingProvider } from "../messaging/messaging-context";
import { AppSwitcherShield } from "../ui/privacy";
import { ActivityProvider } from "../wallet/activity";
import { PortfolioProvider } from "../wallet/use-portfolio";
import { ProfileProvider } from "../profile/profile-context";
import { ToastProvider } from "../ui/overlays";
import { ThemeProvider, useTheme } from "../ui/theme";
import { WalletProvider, useWallet } from "../wallet/wallet-context";

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status } = useWallet();
  const { theme } = useTheme();
  const ready = status !== "loading";

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  return (
    <>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg }, animation: "fade_from_bottom" }}>
        {/* No wallet on this device: onboarding */}
        <Stack.Protected guard={status === "none"}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="create-wallet" />
          <Stack.Screen name="import-wallet" />
        </Stack.Protected>
        {/* Wallet exists but is locked */}
        <Stack.Protected guard={status === "locked"}>
          <Stack.Screen name="unlock" />
        </Stack.Protected>
        {/* Unlocked: the app */}
        <Stack.Protected guard={status === "unlocked"}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chat/[id]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="community/[id]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="edit-profile" options={{ presentation: "modal" }} />
          <Stack.Screen name="notifications" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="send" options={{ presentation: "modal" }} />
          <Stack.Screen name="send-solana" options={{ presentation: "modal" }} />
          <Stack.Screen name="swap" options={{ presentation: "modal" }} />
          <Stack.Screen name="scan" options={{ presentation: "fullScreenModal" }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <WalletProvider>
              <ProfileProvider>
                <ApiProvider>
                  <PortfolioProvider>
                    <ActivityProvider>
                      <MessagingProvider>
                        <RootNavigator />
                        <AppSwitcherShield />
                      </MessagingProvider>
                    </ActivityProvider>
                  </PortfolioProvider>
                </ApiProvider>
              </ProfileProvider>
            </WalletProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
