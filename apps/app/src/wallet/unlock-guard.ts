import AsyncStorage from "@react-native-async-storage/async-storage";
import { decryptVault, WrongPasswordError, type EncryptedVault } from "@henseng/wallet";

/**
 * Slows down password guessing on this device. After 5 wrong passwords in a row, every further
 * attempt must wait: 30 s, then 1, 2, 4, 8 and finally 15 minutes. The counter survives restarts,
 * and a correct password resets it. (The vault is also protected by scrypt, so even a copied vault
 * is slow to attack offline; this guard covers someone trying passwords on the device itself.)
 */
const KEY = "henseng.unlockGuard.v1";
const FREE_ATTEMPTS = 5;
const BASE_WAIT_MS = 30_000;
const MAX_WAIT_MS = 15 * 60_000;

interface GuardState {
  fails: number;
  until: number;
}

export class TooManyAttemptsError extends Error {
  constructor(public waitMs: number) {
    super(`Too many wrong passwords. Try again in ${formatWait(waitMs)}.`);
    this.name = "TooManyAttemptsError";
  }
}

export function formatWait(ms: number) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.ceil(s / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}

async function read(): Promise<GuardState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as GuardState) : null;
    return v && typeof v.fails === "number" && typeof v.until === "number" ? v : { fails: 0, until: 0 };
  } catch {
    return { fails: 0, until: 0 };
  }
}
const write = (s: GuardState) => AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => undefined);

/** Wrong passwords left before waits start (0 once waits apply). */
export async function attemptsLeft(): Promise<number> {
  return Math.max(0, FREE_ATTEMPTS - (await read()).fails);
}

/** decryptVault with attempt limiting. Throws TooManyAttemptsError while a wait is active. */
export async function guardedDecrypt(vault: EncryptedVault, password: string) {
  const s = await read();
  if (Date.now() < s.until) throw new TooManyAttemptsError(s.until - Date.now());
  try {
    const payload = await decryptVault(vault, password);
    if (s.fails) await write({ fails: 0, until: 0 });
    return payload;
  } catch (e) {
    if (e instanceof WrongPasswordError) {
      const fails = s.fails + 1;
      const until = fails >= FREE_ATTEMPTS ? Date.now() + Math.min(MAX_WAIT_MS, BASE_WAIT_MS * 2 ** (fails - FREE_ATTEMPTS)) : 0;
      await write({ fails, until });
    }
    throw e;
  }
}

/** A user-facing message for password errors, or null for anything else. */
export function passwordErrorMessage(e: unknown): string | null {
  if (e instanceof TooManyAttemptsError) return e.message;
  if (e instanceof WrongPasswordError) return "That password isn't right.";
  return null;
}
