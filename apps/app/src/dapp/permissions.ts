import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Sites the user has connected in the dApp browser, kept on this device only. Removing the wallet
 * clears it (every "henseng." key is wiped). Disconnect a site from the browser's site menu.
 */
const KEY = "henseng.dappConnections.v1";
type Store = Record<string, { connectedAt: number; chainId: number }>;

async function read(): Promise<Store> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? "{}") as Store;
  } catch {
    return {};
  }
}

export async function isSiteConnected(origin: string) {
  return Boolean((await read())[origin]);
}
export async function siteChain(origin: string): Promise<number | undefined> {
  return (await read())[origin]?.chainId;
}
export async function setSiteConnected(origin: string, connected: boolean, chainId: number) {
  const s = await read();
  if (connected) s[origin] = { connectedAt: s[origin]?.connectedAt ?? Date.now(), chainId };
  else delete s[origin];
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}
export async function rememberSiteChain(origin: string, chainId: number) {
  const s = await read();
  if (s[origin]) {
    s[origin].chainId = chainId;
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  }
}
export async function connectedSites() {
  return Object.entries(await read()).map(([origin, v]) => ({ origin, ...v })).sort((a, b) => b.connectedAt - a.connectedAt);
}
