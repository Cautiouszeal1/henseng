import * as SecureStore from "expo-secure-store";

/** iOS/Android: the API session token is kept in the Keychain/Keystore. */
const KEY = "henseng.apiToken.v1";
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const loadToken = () => SecureStore.getItemAsync(KEY, OPTS);
export const saveToken = (t: string) => SecureStore.setItemAsync(KEY, t, OPTS);
export const clearToken = () => SecureStore.deleteItemAsync(KEY, OPTS);
