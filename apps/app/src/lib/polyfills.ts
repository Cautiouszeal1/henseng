/**
 * Must be imported before anything that generates keys.
 * iOS/Android (Hermes) have no WebCrypto; expo-crypto supplies a
 * cryptographically secure getRandomValues backed by the OS.
 */
import { getRandomValues } from "expo-crypto";

const g = globalThis as unknown as { crypto?: { getRandomValues?: unknown } };
if (!g.crypto) g.crypto = {};
if (typeof g.crypto.getRandomValues !== "function") {
  g.crypto.getRandomValues = getRandomValues;
}
