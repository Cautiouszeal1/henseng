/**
 * HENSENG design tokens — the approved palette from the product spec.
 * Dark is the primary experience; light mirrors it with the same accents.
 */

export const palette = {
  purple: "#8957FF",
  purpleSoft: "rgba(137,87,255,0.16)",
  blue: "#397BFF",
  blueSoft: "rgba(57,123,255,0.16)",
  orange: "#FF9A4D",
  green: "#2BD67B",
  red: "#FF5C6C",
  amber: "#FFB547",
  white: "#FFFFFF",
} as const;

/** Signature gradient: purple → blue → subtle orange */
export const brandGradient = ["#8957FF", "#397BFF", "#FF9A4D"] as const;
export const buttonGradient = ["#8957FF", "#6F6BFF", "#397BFF"] as const;

export interface Theme {
  mode: "dark" | "light";
  bg: string;
  surface: string;
  card: string;
  cardRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentSoft: string;
  accent2: string;
  positive: string;
  negative: string;
  warning: string;
  overlay: string;
  tabBar: string;
}

export const dark: Theme = {
  mode: "dark",
  bg: "#101014",
  surface: "#171720",
  card: "#1C1B27",
  cardRaised: "#24233290",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  text: "#FFFFFF",
  textSecondary: "#A6A5B3",
  textTertiary: "#6E6D7C",
  accent: palette.purple,
  accentSoft: palette.purpleSoft,
  accent2: palette.blue,
  positive: palette.green,
  negative: palette.red,
  warning: palette.amber,
  overlay: "rgba(5,5,10,0.6)",
  tabBar: "rgba(23,23,32,0.92)",
};

export const light: Theme = {
  mode: "light",
  bg: "#FFFFFF",
  surface: "#F5F5F8",
  card: "#FFFFFF",
  cardRaised: "#F0EFF5",
  border: "rgba(16,16,20,0.08)",
  borderStrong: "rgba(16,16,20,0.14)",
  text: "#101014",
  textSecondary: "#6B6A78",
  textTertiary: "#9A99A6",
  accent: palette.purple,
  accentSoft: "rgba(137,87,255,0.10)",
  accent2: palette.blue,
  positive: "#16A35B",
  negative: "#E5394B",
  warning: "#C77A00",
  overlay: "rgba(16,16,20,0.35)",
  tabBar: "rgba(255,255,255,0.94)",
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, full: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const fonts = {
  display: "Manrope_800ExtraBold",
  heading: "Manrope_700Bold",
  headingMedium: "Manrope_600SemiBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
} as const;

/** Breakpoints: phone < 768 ≤ tablet < 1100 ≤ desktop */
export const breakpoints = { tablet: 768, desktop: 1100 } as const;

/** Avatar gradients, picked deterministically from a name or address. */
export const avatarGradients: readonly (readonly [string, string])[] = [
  ["#8957FF", "#397BFF"],
  ["#FF9A4D", "#FF5C8A"],
  ["#397BFF", "#2BD6C8"],
  ["#B45CFF", "#FF7AB6"],
  ["#2BD67B", "#397BFF"],
  ["#FFB547", "#FF6A3D"],
  ["#5C6BFF", "#B45CFF"],
  ["#00C2FF", "#8957FF"],
];

/** Profile cover gradients the user can choose from. */
export const coverGradients: readonly (readonly [string, string, string])[] = [
  ["#8957FF", "#397BFF", "#FF9A4D"],
  ["#397BFF", "#2BD6C8", "#8957FF"],
  ["#FF5C8A", "#8957FF", "#397BFF"],
  ["#FF9A4D", "#FF5C6C", "#8957FF"],
  ["#1C1B27", "#8957FF", "#397BFF"],
];
