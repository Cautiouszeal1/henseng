import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmbientBackground } from "./ambient";
import { IconButton, Text } from "./primitives";
import { DarkScope } from "./theme";

/** Shared frame for onboarding steps: back button, progress, title, centred column. */
export function OnboardingFrame({
  step,
  total,
  title,
  subtitle,
  children,
  footer,
  onBack,
  hideBack,
}: {
  step?: number;
  total?: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  hideBack?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <DarkScope>
    <View style={{ flex: 1, backgroundColor: "#101014" }}>
      <AmbientBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: "100%", maxWidth: 480, alignSelf: "center", flex: 1, gap: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              {!hideBack && <IconButton icon={ArrowLeft} label="Back" onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/welcome")))} />}
              {step && total ? (
                <View style={{ flex: 1, flexDirection: "row", gap: 6 }} accessibilityLabel={`Step ${step} of ${total}`}>
                  {Array.from({ length: total }, (_, i) => (
                    <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? "#8957FF" : "rgba(255,255,255,0.14)" }} />
                  ))}
                </View>
              ) : null}
            </View>
            <View style={{ gap: 8 }}>
              <Text variant="title" tone="inverse" accessibilityRole="header">{title}</Text>
              {subtitle ? <Text style={{ color: "#B8B6C6" }}>{subtitle}</Text> : null}
            </View>
            <View style={{ gap: 18 }}>{children}</View>
            <View style={{ flex: 1 }} />
            {footer ? <View style={{ gap: 12 }}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
    </DarkScope>
  );
}
