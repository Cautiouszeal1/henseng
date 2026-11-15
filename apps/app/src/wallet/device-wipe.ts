import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { clearToken } from "../api/token-storage";

/**
 * Erasing everything HENSENG keeps on this device when the wallet is removed.
 * Each part of the app that stores data registers how to erase it (and reset its
 * in-memory state); wipeDeviceData() then also removes every remaining "henseng." key.
 */
type Wiper = () => Promise<void> | void;
const wipers = new Set<Wiper>();

export function onDeviceWipe(fn: Wiper): () => void {
  wipers.add(fn);
  return () => void wipers.delete(fn);
}

export async function wipeDeviceData(): Promise<void> {
  for (const fn of [...wipers]) {
    try {
      await fn();
    } catch {
      // Keep going: one failed step must not leave the rest behind.
    }
  }
  await clearToken().catch(() => undefined);
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter((k) => k.startsWith("henseng."));
  if (keys.length) await AsyncStorage.multiRemove(keys).catch(() => undefined);
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    for (const k of Object.keys(localStorage)) if (k.startsWith("henseng.")) localStorage.removeItem(k);
  }
}
