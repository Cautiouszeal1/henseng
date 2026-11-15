import { useId, useMemo, type ReactNode } from "react";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * HENSENG's generated artwork: a small "orbit system" in brand colours — the same
 * rings-and-planets motif as the logo. Every community, dApp, NFT placeholder and
 * cover gets its own composition from a seed (name, id or address), so the same
 * thing always looks the same, and no two look alike.
 */

const PALETTES: readonly (readonly [string, string, string])[] = [
  ["#8957FF", "#397BFF", "#FF9A4D"],
  ["#397BFF", "#2BD6C8", "#8957FF"],
  ["#FF5C8A", "#8957FF", "#397BFF"],
  ["#FF9A4D", "#FF5C6C", "#8957FF"],
  ["#5C6BFF", "#B45CFF", "#FF9A4D"],
  ["#00C2FF", "#397BFF", "#8957FF"],
  ["#2BD67B", "#397BFF", "#8957FF"],
  ["#B45CFF", "#FF7AB6", "#FF9A4D"],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const artPalette = (seed: string) => PALETTES[hash(seed) % PALETTES.length]!;

interface Composition {
  palette: readonly [string, string, string];
  glows: { x: number; y: number; r: number; color: string; opacity: number }[];
  orbits: { cx: number; cy: number; rx: number; ry: number; rot: number; opacity: number }[];
  planets: { x: number; y: number; r: number; color: string }[];
  stars: { x: number; y: number; r: number; o: number }[];
}

function compose(seed: string, w: number, h: number, paletteIndex?: number): Composition {
  const r = rng(hash(seed));
  const palette = paletteIndex === undefined ? artPalette(seed) : PALETTES[paletteIndex % PALETTES.length]!;
  const m = Math.min(w, h);
  const glows = [
    { x: w * (0.15 + r() * 0.35), y: h * (0.1 + r() * 0.4), r: m * (0.75 + r() * 0.35), color: palette[0], opacity: 0.95 },
    { x: w * (0.55 + r() * 0.4), y: h * (0.45 + r() * 0.5), r: m * (0.7 + r() * 0.35), color: palette[1], opacity: 0.85 },
    { x: w * (0.3 + r() * 0.5), y: h * (0.6 + r() * 0.4), r: m * (0.35 + r() * 0.25), color: palette[2], opacity: 0.6 },
  ];
  const cx = w * (0.45 + r() * 0.25);
  const cy = h * (0.4 + r() * 0.25);
  const orbits = [
    { cx, cy, rx: m * (0.55 + r() * 0.25), ry: m * (0.18 + r() * 0.12), rot: -35 + r() * 70, opacity: 0.42 },
    { cx, cy, rx: m * (0.32 + r() * 0.2), ry: m * (0.1 + r() * 0.08), rot: -60 + r() * 120, opacity: 0.26 },
  ];
  const onOrbit = (o: Composition["orbits"][number], t: number) => {
    const a = (o.rot * Math.PI) / 180;
    const px = o.rx * Math.cos(t);
    const py = o.ry * Math.sin(t);
    return { x: o.cx + px * Math.cos(a) - py * Math.sin(a), y: o.cy + px * Math.sin(a) + py * Math.cos(a) };
  };
  const planets = [
    { ...onOrbit(orbits[0]!, r() * Math.PI * 2), r: m * 0.045, color: "#FFFFFF" },
    { ...onOrbit(orbits[0]!, r() * Math.PI * 2), r: m * 0.03, color: palette[2] },
    { ...onOrbit(orbits[1]!, r() * Math.PI * 2), r: m * 0.025, color: "#FFFFFF" },
  ];
  const stars = Array.from({ length: Math.round(8 + (w / h) * 6) }, () => ({ x: r() * w, y: r() * h, r: m * (0.005 + r() * 0.01), o: 0.15 + r() * 0.45 }));
  return { palette, glows, orbits, planets, stars };
}

/**
 * The artwork itself. `aspect` is width/height (1 for tiles and avatars, 3 for wide covers).
 * Children (e.g. an initial letter) are layered on top, centred.
 */
export function OrbitArt({
  seed,
  aspect = 1,
  radius = 0,
  style,
  children,
  quiet = false,
  paletteIndex,
}: {
  seed: string;
  /** Pin the colour set (e.g. a cover the user picked) instead of deriving it from the seed */
  paletteIndex?: number;
  aspect?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Fewer details, for very small sizes */
  quiet?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const H = 100;
  const W = Math.round(100 * aspect);
  const c = useMemo(() => compose(seed, W, H, paletteIndex), [seed, W, paletteIndex]);
  return (
    <View style={[{ aspectRatio: aspect, borderRadius: radius, overflow: "hidden", backgroundColor: "#141327" }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={`bg${uid}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#1D1838" />
            <Stop offset="1" stopColor="#0E0F1E" />
          </LinearGradient>
          {c.glows.map((g, i) => (
            <RadialGradient key={i} id={`g${i}${uid}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={g.color} stopOpacity={g.opacity} />
              <Stop offset="0.55" stopColor={g.color} stopOpacity={g.opacity * 0.35} />
              <Stop offset="1" stopColor={g.color} stopOpacity="0" />
            </RadialGradient>
          ))}
          <RadialGradient id={`p${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={W} height={H} fill={`url(#bg${uid})`} />
        {c.glows.map((g, i) => (
          <Circle key={i} cx={g.x} cy={g.y} r={g.r} fill={`url(#g${i}${uid})`} />
        ))}
        {quiet ? null : c.stars.map((s, i) => <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o} />)}
        {c.orbits.map((o, i) => (
          <G key={i} rotation={o.rot} origin={`${o.cx}, ${o.cy}`}>
            <Ellipse cx={o.cx} cy={o.cy} rx={o.rx} ry={o.ry} stroke="#FFFFFF" strokeOpacity={o.opacity} strokeWidth={quiet ? 1.6 : 0.9} fill="none" />
          </G>
        ))}
        {c.planets.slice(0, quiet ? 1 : 3).map((p, i) => (
          <G key={i}>
            <Circle cx={p.x} cy={p.y} r={p.r * 3.2} fill={`url(#p${uid})`} opacity={0.35} />
            <Circle cx={p.x} cy={p.y} r={p.r} fill={p.color} />
          </G>
        ))}
      </Svg>
      {children ? <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>{children}</View> : null}
    </View>
  );
}

/** Profile cover artwork; `index` is the user's chosen cover (0–4). */
export const COVER_COUNT = 5;
export function ProfileCover({ index, height, radius = 0 }: { index: number; height: number; radius?: number }) {
  return <OrbitArt seed={`cover-${index % COVER_COUNT}`} paletteIndex={index % COVER_COUNT} radius={radius} style={{ width: "100%", height, aspectRatio: undefined }} />;
}

/** An icon on a brand-gradient badge, circled by orbit rings — used for empty states and onboarding steps. */
export function IconOrbit({ children, size = 1 }: { children: ReactNode; size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const w = 132 * size;
  const h = 104 * size;
  const badge = 56 * size;
  return (
    <View style={{ width: w, height: h, alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={w} height={h} viewBox="0 0 132 104" style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id={`r${uid}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#8957FF" />
            <Stop offset="0.6" stopColor="#397BFF" />
            <Stop offset="1" stopColor="#FF9A4D" />
          </LinearGradient>
          <RadialGradient id={`g${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#8957FF" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#8957FF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="66" cy="52" r="50" fill={`url(#g${uid})`} />
        <G rotation={-14} origin="66, 52">
          <Ellipse cx="66" cy="52" rx="60" ry="18" stroke={`url(#r${uid})`} strokeWidth="1.2" fill="none" opacity={0.7} />
        </G>
        <G rotation={28} origin="66, 52">
          <Ellipse cx="66" cy="52" rx="40" ry="44" stroke={`url(#r${uid})`} strokeWidth="1" fill="none" opacity={0.35} />
        </G>
        <Circle cx="120" cy="38" r="4" fill="#FF9A4D" />
        <Circle cx="14" cy="64" r="3" fill="#397BFF" />
        <Circle cx="84" cy="10" r="2.5" fill="#FFFFFF" opacity={0.8} />
      </Svg>
      <ExpoLinearGradient colors={["#8957FF", "#397BFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: badge, height: badge, borderRadius: badge * 0.36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
        {children}
      </ExpoLinearGradient>
    </View>
  );
}

/** Soft brand glow for screen backgrounds (static, no motion). */
export function ScreenGlow({ intensity = 1 }: { intensity?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden" }}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`a${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#8957FF" stopOpacity={0.22 * intensity} />
            <Stop offset="1" stopColor="#8957FF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`b${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#397BFF" stopOpacity={0.14 * intensity} />
            <Stop offset="1" stopColor="#397BFF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`c${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FF9A4D" stopOpacity={0.07 * intensity} />
            <Stop offset="1" stopColor="#FF9A4D" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx="8" cy="-4" rx="62" ry="34" fill={`url(#a${uid})`} />
        <Ellipse cx="98" cy="14" rx="48" ry="26" fill={`url(#b${uid})`} />
        <Ellipse cx="88" cy="104" rx="56" ry="28" fill={`url(#c${uid})`} />
      </Svg>
    </View>
  );
}
