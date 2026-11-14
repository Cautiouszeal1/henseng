import { isEncryptedVault, type EncryptedVault } from "@henseng/wallet";

/**
 * Web and Chrome extension: the vault is already encrypted with the user's
 * password (scrypt + AES-256-GCM), so it is stored as ciphertext in browser
 * storage on this device only. The extension build (Phase 5) moves this into
 * chrome.storage.local, owned by the background service worker.
 */
const KEY = "henseng.vault.v1";

export async function loadVault(): Promise<EncryptedVault | null> {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isEncryptedVault(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveVault(vault: EncryptedVault): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify(vault));
}

export async function deleteVault(): Promise<void> {
  localStorage.removeItem(KEY);
}

export const vaultLocationLabel = "this browser, encrypted with your password";
