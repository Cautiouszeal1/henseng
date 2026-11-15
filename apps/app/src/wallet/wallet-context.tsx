import {
  decryptVault,
  deriveEvmAccount,
  deriveSolanaKeypair,
  encryptVault,
  isValidMnemonic,
  normalizeMnemonic,
  signTransaction,
  WrongPasswordError,
} from "@henseng/wallet";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { createWalletClient, http } from "viem";
import { networkFor, rpcUrl } from "./networks";
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
  /** Solana address from the same recovery phrase (m/44'/501'/0'/0', Phantom-compatible) */
  solanaAddress: string | null;
  /** Signs a compiled Solana message on this device; returns wire bytes and the signature (tx id). */
  signSolana: (message: Uint8Array) => { wire: Uint8Array; signature: string };
  /** Creates (or imports) a wallet, encrypts it and unlocks it. */
  createWallet: (mnemonic: string, password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  /** Re-verifies the password and returns the phrase for a backup screen. */
  revealPhrase: (password: string) => Promise<string>;
  /** Removes the wallet from this device. Funds stay on-chain; the phrase restores them. */
  removeWallet: () => Promise<void>;
  /** Signs a plain-text message (EIP-191) with the unlocked account. Used for HENSENG sign-in. */
  signMessage: (message: string) => Promise<`0x${string}`>;
  /** Checks the password against the encrypted vault. Used to confirm a send. */
  verifyPassword: (password: string) => Promise<boolean>;
  /** Signs and broadcasts a transaction on this device. Resolves with the hash once the network accepts it. */
  sendTransaction: (tx: { chainId: number; to: `0x${string}`; value?: bigint; data?: `0x${string}`; gas?: bigint }) => Promise<`0x${string}`>;
  touch: () => void;
}

const Ctx = createContext<WalletApi | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [solanaAddress, setSolanaAddress] = useState<string | null>(null);
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
    setSolanaAddress(null);
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
    setSolanaAddress(deriveSolanaKeypair(clean).address);
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
    setSolanaAddress(deriveSolanaKeypair(payload.mnemonic).address);
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
    setSolanaAddress(null);
    setSolanaAddress(null);
    setStatus("none");
  }, []);

  const signMessage = useCallback(async (message: string) => {
    if (!phrase.current) throw new Error("Unlock HENSENG first.");
    lastActive.current = Date.now();
    return deriveEvmAccount(phrase.current).signMessage({ message });
  }, []);

  const verifyPassword = useCallback(async (password: string) => {
    const vault = await loadVault();
    if (!vault) return false;
    try {
      await decryptVault(vault, password);
      return true;
    } catch (e) {
      if (e instanceof WrongPasswordError) return false;
      throw e;
    }
  }, []);

  const sendTransaction = useCallback<WalletApi["sendTransaction"]>(async ({ chainId, to, value, data, gas }) => {
    if (!phrase.current) throw new Error("Unlock HENSENG first.");
    const network = networkFor(chainId);
    if (!network) throw new Error("Unsupported network.");
    lastActive.current = Date.now();
    const client = createWalletClient({ account: deriveEvmAccount(phrase.current), chain: network.chain, transport: http(rpcUrl(chainId), { timeout: 20_000 }) });
    return client.sendTransaction({ to, value, data, gas });
  }, []);

  const signSolana = useCallback<WalletApi["signSolana"]>((message) => {
    if (!phrase.current) throw new Error("Unlock HENSENG first.");
    lastActive.current = Date.now();
    return signTransaction(message, deriveSolanaKeypair(phrase.current).secret);
  }, []);

  const value = useMemo<WalletApi>(
    () => ({ status, address, solanaAddress, signSolana, createWallet, unlock, lock, revealPhrase, removeWallet, signMessage, verifyPassword, sendTransaction, touch: () => (lastActive.current = Date.now()) }),
    [status, address, solanaAddress, signSolana, createWallet, unlock, lock, revealPhrase, removeWallet, signMessage, verifyPassword, sendTransaction],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used inside WalletProvider");
  return v;
}

export { WrongPasswordError };
