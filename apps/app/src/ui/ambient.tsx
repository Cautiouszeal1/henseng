import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * Onboarding backdrop: purple and blue ambient light with a slowly drifting
 * glow, plus an abstract "orbit" — HENSENG's networks circling one identity.
 * Motion is disabled when the OS asks for reduced motion.
 */
export function AmbientBackground() {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduce) t.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, t]);
  const drift = useAnimatedStyle(() => ({ transform: [{ translateX: -30 + t.value * 60 }, { translateY: -20 + t.value * 30 }] }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={["#18122E", "#101014", "#101014"]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[{ position: "absolute", top: -120, left: -80, width: 420, height: 420 }, drift]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="p" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#8957FF" stopOpacity="0.55" />
              <Stop offset="1" stopColor="#8957FF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="210" cy="210" r="210" fill="url(#p)" />
        </Svg>
      </Animated.View>
      <View style={{ position: "absolute", bottom: -160, right: -120, width: 460, height: 460 }}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="b" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#397BFF" stopOpacity="0.45" />
              <Stop offset="0.7" stopColor="#FF9A4D" stopOpacity="0.06" />
              <Stop offset="1" stopColor="#397BFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="230" cy="230" r="230" fill="url(#b)" />
        </Svg>
      </View>
    </View>
  );
}

export function OrbitVisual({ size = 260 }: { size?: number }) {
  const reduce = useReducedMotion();
  const spin = useSharedValue(0);
  useEffect(() => {
    if (!reduce) spin.value = withRepeat(withTiming(360, { duration: 40000, easing: Easing.linear }), -1, false);
  }, [reduce, spin]);
  const rotate = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const c = size / 2;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, rotate]}>
        <Svg width={size} height={size}>
          <Defs>
            <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#8957FF" />
              <Stop offset="0.55" stopColor="#397BFF" />
              <Stop offset="1" stopColor="#FF9A4D" />
            </SvgGradient>
          </Defs>
          <Ellipse cx={c} cy={c} rx={c - 8} ry={c * 0.42} stroke="url(#ring)" strokeWidth="1.5" fill="none" opacity={0.7} />
          <Ellipse cx={c} cy={c} rx={c * 0.42} ry={c - 8} stroke="url(#ring)" strokeWidth="1.5" fill="none" opacity={0.45} />
          <Circle cx={c + (c - 8)} cy={c} r="7" fill="#397BFF" />
          <Circle cx={c} cy={8} r="6" fill="#FF9A4D" />
          <Circle cx={c - (c - 8)} cy={c} r="5" fill="#8957FF" />
          <Circle cx={c} cy={size - 8} r="4" fill="#FFFFFF" opacity={0.8} />
        </Svg>
      </Animated.View>
      <View style={{ position: "absolute", left: c - 46, top: c - 46, width: 92, height: 92, borderRadius: 30, overflow: "hidden" }}>
        <LinearGradient colors={["#8957FF", "#397BFF", "#FF9A4D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Svg width={56} height={56} viewBox="0 0 64 64">
            {/* HENSENG mark, white on gradient */}
            <RectMark />
          </Svg>
        </LinearGradient>
      </View>
    </View>
  );
}

function RectMark() {
  return (
    <>
      <Rect x="10" y="10" width="10" height="44" rx="5" fill="#FFFFFF" />
      <Rect x="44" y="10" width="10" height="44" rx="5" fill="#FFFFFF" />
      <Path d="M18 35 C 27 35, 34 29, 46 29" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" fill="none" />
    </>
  );
}
