import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme, useWindowDimensions } from "react-native";
import { breakpoints, dark, light, type Theme } from "./tokens";

export type ThemePreference = "system" | "dark" | "light";
const KEY = "henseng.theme";

interface ThemeApi {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const Ctx = createContext<ThemeApi | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  // Dark is the primary experience (brand spec), so it is the default until the user picks another theme.
  const [preference, setPref] = useState<ThemePreference>("dark");

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === "dark" || v === "light" || v === "system") setPref(v);
    });
  }, []);

  const value = useMemo<ThemeApi>(() => {
    const mode = preference === "system" ? (system === "light" ? "light" : "dark") : preference;
    return {
      theme: mode === "light" ? light : dark,
      preference,
      setPreference: (p) => {
        setPref(p);
        void AsyncStorage.setItem(KEY, p);
      },
    };
  }, [preference, system]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Forces the dark palette for a subtree (onboarding is always dark, per the brand spec). */
export function DarkScope({ children }: { children: ReactNode }) {
  const parent = useContext(Ctx);
  const value = useMemo<ThemeApi>(
    () => ({ theme: dark, preference: parent?.preference ?? "dark", setPreference: parent?.setPreference ?? (() => undefined) }),
    [parent],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside ThemeProvider");
  return v;
}

export function useLayout() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isPhone: width < breakpoints.tablet,
    isTablet: width >= breakpoints.tablet && width < breakpoints.desktop,
    isDesktop: width >= breakpoints.desktop,
    isWide: width >= breakpoints.tablet,
  };
}
