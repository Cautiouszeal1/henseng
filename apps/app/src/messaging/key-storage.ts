import * as SecureStore from "expo-secure-store";

/**
 * iOS/Android: XMTP keeps an encrypted local database of your messages. Its
 * 32-byte key is random per wallet and lives in the Keychain/Keystore.
 */
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

function toHex(b: Uint8Array) {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
function fromHex(h: string) {
  return new Uint8Array(h.match(/.{2}/g)!.map((x) => parseInt(x, 16)));
}

export async function getDbKey(address: string): Promise<Uint8Array> {
  const k = `henseng.xmtpdb.${address.toLowerCase()}`;
  const existing = await SecureStore.getItemAsync(k, OPTS);
  if (existing && existing.length === 64) return fromHex(existing);
  const key = new Uint8Array(32);
  globalThis.crypto.getRandomValues(key);
  await SecureStore.setItemAsync(k, toHex(key), OPTS);
  return key;
}

/** Deletes this wallet's message-database key; without it the encrypted database can never be read. */
export async function deleteDbKey(address: string): Promise<void> {
  await SecureStore.deleteItemAsync(`henseng.xmtpdb.${address.toLowerCase()}`, OPTS);
}
