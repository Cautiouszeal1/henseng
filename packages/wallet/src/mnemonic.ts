import { generateMnemonic as genMnemonic, validateMnemonic as checkMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { mnemonicToAccount } from "viem/accounts";

/**
 * Seed phrases follow BIP-39 (English word list). Generation uses the
 * platform's cryptographically secure random source (WebCrypto in browsers
 * and the extension; expo-crypto installs it on iOS and Android).
 */

export type WordCount = 12 | 24;

export function generateMnemonic(words: WordCount = 12): string {
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("Secure random number generator is not available on this device.");
  }
  return genMnemonic(wordlist, words === 24 ? 256 : 128);
}

/** Normalises user input: lower case, single spaces, trimmed. */
export function normalizeMnemonic(input: string): string {
  return input.trim().toLowerCase().split(/\s+/).join(" ");
}

export function isValidMnemonic(input: string): boolean {
  return checkMnemonic(normalizeMnemonic(input), wordlist);
}

/** Words that are not in the BIP-39 English list, for precise error messages. */
export function unknownWords(input: string): string[] {
  const set = new Set(wordlist);
  return normalizeMnemonic(input)
    .split(" ")
    .filter((w) => w && !set.has(w));
}

/** Standard Ethereum derivation path m/44'/60'/0'/0/{index}. */
export function deriveEvmAccount(mnemonic: string, index = 0) {
  return mnemonicToAccount(normalizeMnemonic(mnemonic), { addressIndex: index });
}

/**
 * Picks positions (1-based) the user must re-enter to prove they wrote the
 * phrase down. Uses secure randomness so positions are not predictable.
 */
export function pickConfirmationPositions(wordCount: number, count = 3): number[] {
  const picked = new Set<number>();
  const buf = new Uint32Array(1);
  while (picked.size < Math.min(count, wordCount)) {
    globalThis.crypto.getRandomValues(buf);
    picked.add((buf[0]! % wordCount) + 1);
  }
  return [...picked].sort((a, b) => a - b);
}
