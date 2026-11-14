import { CheckCircle2, AlertCircle, X } from "lucide-react-native";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, Text } from "./primitives";
import { useLayout, useTheme } from "./theme";
import { radius, space } from "./tokens";

/**
 * Bottom sheet on phones, centred dialog on tablet/desktop — one component,
 * layout chosen by screen size rather than stretching the phone design.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const { isWide, height } = useLayout();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={isWide ? "fade" : "slide"} onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: theme.overlay, justifyContent: isWide ? "center" : "flex-end", alignItems: "center" }} accessibilityLabel="Close">
        <Pressable
          onPress={() => undefined}
          accessibilityViewIsModal
          style={{
            width: isWide ? 460 : "100%",
            maxHeight: height * (isWide ? 0.85 : 0.92),
            backgroundColor: theme.card,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderBottomLeftRadius: isWide ? radius.xl : 0,
            borderBottomRightRadius: isWide ? radius.xl : 0,
            borderWidth: 1,
            borderColor: theme.border,
            paddingBottom: isWide ? space.xl : insets.bottom + space.lg,
          }}
        >
          {!isWide && <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: theme.borderStrong, marginTop: 10 }} />}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.md }}>
            <Text variant="heading" accessibilityRole="header">{title}</Text>
            <IconButton icon={X} label="Close" onPress={onClose} size={34} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ───────────── Toasts ───────────── */

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };
const ToastCtx = createContext<(message: string, tone?: Toast["tone"]) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const id = useRef(0);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const show = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const t = { id: ++id.current, message, tone };
    setToasts((prev) => [...prev.slice(-2), t]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 96, alignItems: "center", gap: 8 }}>
        {toasts.map((t) => {
          const Icon = t.tone === "error" ? AlertCircle : CheckCircle2;
          const color = t.tone === "error" ? theme.negative : t.tone === "success" ? theme.positive : theme.accent;
          return (
            <Animated.View
              key={t.id}
              entering={FadeInDown.duration(220)}
              exiting={FadeOutDown.duration(180)}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                maxWidth: 420,
                marginHorizontal: 16,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: radius.lg,
                backgroundColor: theme.mode === "dark" ? "#24233A" : "#101014",
                borderWidth: 1,
                borderColor: theme.borderStrong,
              }}
            >
              <Icon size={18} color={color} />
              <Text variant="caption" style={{ color: "#FFFFFF", flexShrink: 1 }}>{t.message}</Text>
            </Animated.View>
          );
        })}
      </View>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
