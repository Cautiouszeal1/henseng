import * as SecureStore from "expo-secure-store";
import { isEncryptedVault, type EncryptedVault } from "@henseng/wallet";

/**
 * iOS / Android: the encrypted vault lives in the Keychain / Keystore via
 * expo-secure-store, only readable after first unlock of the device and
 * never included in cloud backups.
 */
const KEY = "henseng.vault.v1";
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function loadVault(): Promise<EncryptedVault | null> {
  const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  return isEncryptedVault(parsed) ? parsed : null;
}

export async function saveVault(vault: EncryptedVault): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(vault), OPTIONS);
}

export async function deleteVault(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY, OPTIONS);
}

export const vaultLocationLabel = "this device's secure keychain";
