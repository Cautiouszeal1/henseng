import {
  decryptVault,
  deriveEvmAccount,
  encryptVault,
  isValidMnemonic,
  normalizeMnemonic,
  WrongPasswordError,
} from "@henseng/wallet";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { deleteVault, loadVault, saveVault } from "./vault-storage";

/**
 * Wallet session state.
 *
 * - "none":     no wallet on this device yet → onboarding
 * - "locked":   an encrypted vault exists → ask for the password
 * - "unlocked": the address is known; the seed phrase is held in memory only
 *
 * The phrase is dropped from memory on lock, on app background (after a grace
 * period) and after inactivity. It is never written anywhere unencrypted and
 * never sent over the network.
 */

type Status = "loading" | "none" | "locked" | "unlocked";

const AUTO_LOCK_MS = 15 * 60 * 1000;
const BACKGROUND_GRACE_MS = 60 * 1000;

interface WalletApi {
  status: Status;
  address: `0x${string}` | null;
  /** Creates (or imports) a wallet, encrypts it and unlocks it. */
  createWallet: (mnemonic: string, password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  /** Re-verifies the password and returns the phrase for a backup screen. */
  revealPhrase: (password: string) => Promise<string>;
  /** Removes the wallet from this device. Funds stay on-chain; the phrase restores them. */
  removeWallet: () => Promise<void>;
  touch: () => void;
}

const Ctx = createContext<WalletApi | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const phrase = useRef<string | null>(null);
  const lastActive = useRef(Date.now());
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    loadVault()
      .then((v) => setStatus(v ? "locked" : "none"))
      .catch(() => setStatus("none"));
  }, []);

  const lock = useCallback(() => {
    phrase.current = null;
    setAddress(null);
    setStatus((s) => (s === "unlocked" ? "locked" : s));
  }, []);

  // Auto-lock after inactivity, and after time in the background.
  useEffect(() => {
    const timer = setInterval(() => {
      if (phrase.current && Date.now() - lastActive.current > AUTO_LOCK_MS) lock();
    }, 30_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") backgroundedAt.current = Date.now();
      if (state === "active" && backgroundedAt.current && Date.now() - backgroundedAt.current > BACKGROUND_GRACE_MS) lock();
      if (state === "active") backgroundedAt.current = null;
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [lock]);

  const createWallet = useCallback(async (mnemonic: string, password: string) => {
    const clean = normalizeMnemonic(mnemonic);
    if (!isValidMnemonic(clean)) throw new Error("That recovery phrase is not valid.");
    const account = deriveEvmAccount(clean);
    const vault = await encryptVault({ mnemonic: clean, accountCount: 1, createdAt: new Date().toISOString() }, password);
    await saveVault(vault);
    phrase.current = clean;
    lastActive.current = Date.now();
    setAddress(account.address);
    setStatus("unlocked");
  }, []);

  const unlock = useCallback(async (password: string) => {
    const vault = await loadVault();
    if (!vault) {
      setStatus("none");
      throw new Error("No wallet found on this device.");
    }
    const payload = await decryptVault(vault, password); // throws WrongPasswordError
    phrase.current = payload.mnemonic;
    lastActive.current = Date.now();
    setAddress(deriveEvmAccount(payload.mnemonic).address);
    setStatus("unlocked");
  }, []);

  const revealPhrase = useCallback(async (password: string) => {
    const vault = await loadVault();
    if (!vault) throw new Error("No wallet found on this device.");
    return (await decryptVault(vault, password)).mnemonic;
  }, []);

  const removeWallet = useCallback(async () => {
    await deleteVault();
    phrase.current = null;
    setAddress(null);
    setStatus("none");
  }, []);

  const value = useMemo<WalletApi>(
    () => ({ status, address, createWallet, unlock, lock, revealPhrase, removeWallet, touch: () => (lastActive.current = Date.now()) }),
    [status, address, createWallet, unlock, lock, revealPhrase, removeWallet],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used inside WalletProvider");
  return v;
}

export { WrongPasswordError };
