import { router } from "expo-router";
import { Lock, MessageCircle, Sparkles, Wallet } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmbientBackground, OrbitVisual } from "../ui/ambient";
import { Wordmark } from "../ui/logo";
import { Button, Tap, Text } from "../ui/primitives";
import { DarkScope, useLayout } from "../ui/theme";

const SLIDES = [
  { icon: MessageCircle, title: "Chat privately", body: "End-to-end encrypted messages with friends, groups and communities." },
  { icon: Wallet, title: "Own your assets", body: "A multi-chain wallet where only you hold the keys. Send, swap and bridge." },
  { icon: Sparkles, title: "Explore Web3", body: "Discover dApps, DeFi and NFTs from one secure, private browser." },
] as const;

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { isWide } = useLayout();
  const [slide, setSlide] = useState(0);
  const current = SLIDES[slide]!;

  const content = (
    <View style={{ width: "100%", maxWidth: 440, alignSelf: "center", gap: 28 }}>
      <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: "center", gap: 18 }}>
        <Text variant="display" tone="inverse" style={{ textAlign: "center", fontSize: isWide ? 44 : 38, lineHeight: isWide ? 48 : 42 }}>
          Your Web3{"\n"}Super App
        </Text>
        <Text tone="secondary" style={{ textAlign: "center", color: "#C9C7D6" }}>
          Chat · Connect · Trade · Explore{"\n"}All in one place
        </Text>
      </Animated.View>

      <Tap onPress={() => setSlide((s) => (s + 1) % SLIDES.length)} haptic={false} accessibilityRole="button" accessibilityLabel={`${current.title}. ${current.body}. Next feature`}>
        <Animated.View key={slide} entering={FadeIn.duration(300)} style={{ flexDirection: "row", gap: 14, alignItems: "center", padding: 16, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(137,87,255,0.22)", alignItems: "center", justifyContent: "center" }}>
            <current.icon size={22} color="#C4ADFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" tone="inverse">{current.title}</Text>
            <Text variant="caption" style={{ color: "#B8B6C6" }}>{current.body}</Text>
          </View>
        </Animated.View>
      </Tap>
      <View style={{ flexDirection: "row", gap: 6, justifyContent: "center" }} accessibilityElementsHidden>
        {SLIDES.map((_, i) => (
          <View key={i} style={{ height: 6, width: i === slide ? 22 : 6, borderRadius: 3, backgroundColor: i === slide ? "#8957FF" : "rgba(255,255,255,0.25)" }} />
        ))}
      </View>

      <View style={{ gap: 12 }}>
        <Button label="Create account" onPress={() => router.push("/create-wallet")} />
        <Button label="I already have a wallet" kind="secondary" onPress={() => router.push("/import-wallet")} style={{ borderColor: "rgba(255,255,255,0.22)" }} />
      </View>

      <View style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }}>
        <Lock size={13} color="#8E8C9E" />
        <Text variant="caption" style={{ color: "#8E8C9E", textAlign: "center" }}>
          No email or phone number needed. Your keys never leave your device.
        </Text>
      </View>
    </View>
  );

  return (
    <DarkScope>
    <View style={{ flex: 1, backgroundColor: "#101014" }}>
      <AmbientBackground />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 24,
          justifyContent: "center",
          gap: 24,
          ...(isWide ? { flexDirection: "row", alignItems: "center", gap: 80 } : {}),
        }}
      >
        <View style={{ alignItems: "center", gap: isWide ? 32 : 20 }}>
          <Wordmark size={30} />
          <OrbitVisual size={isWide ? 380 : 240} />
        </View>
        {content}
      </ScrollView>
    </View>
    </DarkScope>
  );
}
