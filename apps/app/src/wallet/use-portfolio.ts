import AsyncStorage from "@react-native-async-storage/async-storage";
import { ERC20_ABI, PRICE_IDS, TOKENS, tokenKey, type TokenInfo } from "@henseng/wallet";
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatUnits, getAddress, isAddress } from "viem";
import { API_URL, useApi } from "../api/api-context";
import { ALL_NETWORKS, networkFor, publicClient, type NetworkInfo } from "./networks";
import { getSolBalance, getSplBalance } from "./solana-rpc";
import { onDeviceWipe } from "./device-wipe";
import { useWallet } from "./wallet-context";

export interface WalletToken extends TokenInfo {
  /** Added by the user by contract address; not on HENSENG's verified list */
  custom?: boolean;
}

export interface Holding {
  key: string;
  token: WalletToken;
  network: NetworkInfo;
  balance: bigint;
  /** USD value, only when a real price was available */
  usd?: number;
}

export interface NetworkStatus {
  network: NetworkInfo;
  status: "loading" | "ok" | "error";
}

export interface Price {
  usd: number;
  change24h: number | null;
  stale: boolean;
}

export type PriceState = { status: "off" | "loading" | "error" } | { status: "ok"; prices: Record<string, Price>; updatedAt: Date };

const CUSTOM_KEY = "henseng.customTokens.v1";
const ERC20_META = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

/** Strips control and direction-override characters and caps length: token names are attacker-controlled text. */
const cleanLabel = (s: string, max: number) => s.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮]/g, "").trim().slice(0, max);

/**
 * Reads balances straight from each network (EVM and Solana; the user's addresses don't go
 * to HENSENG for this) and USD prices from the HENSENG API. Native assets are always listed;
 * verified tokens appear once they have a balance; custom tokens always show so they can be removed.
 */
function usePortfolioState(address: `0x${string}` | null, solanaAddress: string | null, includeTestnets: boolean) {
  const { request } = useApi();
  const [custom, setCustom] = useState<WalletToken[]>([]);
  const [statuses, setStatuses] = useState<NetworkStatus[]>([]);
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [prices, setPrices] = useState<PriceState>({ status: API_URL ? "loading" : "off" });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const run = useRef(0);

  useEffect(() => {
    void AsyncStorage.getItem(CUSTOM_KEY).then((raw) => raw && setCustom(JSON.parse(raw) as WalletToken[]));
  }, []);
  useEffect(
    () =>
      onDeviceWipe(() => {
        setCustom([]);
        setBalances({});
        setUpdatedAt(null);
      }),
    [],
  );
  const saveCustom = useCallback((list: WalletToken[]) => {
    setCustom(list);
    void AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  }, []);

  const allTokens: WalletToken[] = useMemo(() => [...TOKENS, ...custom], [custom]);

  const loadPrices = useCallback(async () => {
    if (!API_URL) return setPrices({ status: "off" });
    setPrices((p) => (p.status === "ok" ? p : { status: "loading" }));
    try {
      const r = await request<{ prices: Record<string, Price> }>("GET", `/prices?ids=${PRICE_IDS.join(",")}`);
      setPrices({ status: "ok", prices: r.prices, updatedAt: new Date() });
    } catch {
      setPrices((p) => (p.status === "ok" ? p : { status: "error" }));
    }
  }, [request]);

  const readNetwork = useCallback(
    async (network: NetworkInfo, tokens: WalletToken[]): Promise<[WalletToken, bigint | null][]> => {
      if (network.kind === "solana") {
        if (!solanaAddress) return [];
        return Promise.all(
          tokens.map(async (t): Promise<[WalletToken, bigint]> => [t, t.address ? await getSplBalance(network.id, solanaAddress, t.address) : await getSolBalance(network.id, solanaAddress)]),
        );
      }
      if (!address) return [];
      const client = publicClient(network.id);
      return Promise.all(
        tokens.map(async (t): Promise<[WalletToken, bigint | null]> => {
          if (!t.address) return [t, await client.getBalance({ address })];
          // A single unreadable token shouldn't hide the rest of the network.
          const v = await client.readContract({ address: t.address as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }).catch(() => null);
          return [t, v];
        }),
      );
    },
    [address, solanaAddress],
  );

  const refresh = useCallback(() => {
    if (!address) return;
    const id = ++run.current;
    const list = ALL_NETWORKS.filter((n) => includeTestnets || !n.testnet);
    setStatuses(list.map((n) => ({ network: n, status: "loading" })));
    void loadPrices();
    void Promise.all(
      list.map(async (network) => {
        try {
          const values = await readNetwork(network, allTokens.filter((t) => t.chainId === network.id));
          if (id !== run.current) return;
          setBalances((prev) => {
            const next = { ...prev };
            for (const [t, v] of values) if (v !== null) next[tokenKey(t)] = v;
            return next;
          });
          setStatuses((s) => s.map((x) => (x.network.id === network.id ? { network, status: "ok" } : x)));
        } catch {
          if (id !== run.current) return;
          setStatuses((s) => s.map((x) => (x.network.id === network.id ? { network, status: "error" } : x)));
        }
      }),
    ).then(() => id === run.current && setUpdatedAt(new Date()));
  }, [address, includeTestnets, loadPrices, readNetwork, allTokens]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Looks a token up on-chain by contract address and adds it. */
  const addCustomToken = useCallback(
    async (chainId: number, input: string): Promise<{ token: WalletToken } | { error: string }> => {
      const network = networkFor(chainId);
      if (!network) return { error: "Custom tokens can be added on Ethereum, Base, Arbitrum and their testnets." };
      const raw = input.trim();
      if (!isAddress(raw, { strict: false })) return { error: "Enter the token's contract address (0x…)." };
      const contract = getAddress(raw);
      if (allTokens.some((t) => t.chainId === chainId && t.address?.toLowerCase() === contract.toLowerCase())) return { error: "That token is already in your wallet." };
      const client = publicClient(chainId);
      try {
        const code = await client.getCode({ address: contract });
        if (!code || code === "0x") return { error: `There's no contract at that address on ${network.name}. Check the network.` };
        const [decimals, symbol, name] = await Promise.all([
          client.readContract({ address: contract, abi: ERC20_META, functionName: "decimals" }),
          client.readContract({ address: contract, abi: ERC20_META, functionName: "symbol" }).catch(() => "TOKEN"),
          client.readContract({ address: contract, abi: ERC20_META, functionName: "name" }).catch(() => "Unknown token"),
        ]);
        if (decimals > 36) return { error: "That contract doesn't look like a standard token." };
        const token: WalletToken = { chainId, address: contract, symbol: cleanLabel(symbol, 12) || "TOKEN", name: cleanLabel(name, 40) || "Unknown token", decimals, custom: true };
        saveCustom([...custom, token]);
        return { token };
      } catch {
        return { error: "That contract didn't answer like a token (ERC-20), or the network couldn't be reached." };
      }
    },
    [allTokens, custom, saveCustom],
  );

  const removeCustomToken = useCallback(
    (t: Pick<TokenInfo, "chainId" | "address">) => saveCustom(custom.filter((c) => tokenKey(c) !== tokenKey(t))),
    [custom, saveCustom],
  );

  const priceOf = (t: TokenInfo) => (prices.status === "ok" && t.priceId ? prices.prices[t.priceId] : undefined);
  const holdings: Holding[] = [];
  for (const s of statuses) {
    if (s.status !== "ok") continue;
    for (const token of allTokens.filter((t) => t.chainId === s.network.id)) {
      const balance = balances[tokenKey(token)];
      if (balance === undefined || (token.address && !token.custom && balance === 0n)) continue;
      const p = priceOf(token);
      holdings.push({ key: tokenKey(token), token, network: s.network, balance, usd: p ? Number(formatUnits(balance, token.decimals)) * p.usd : undefined });
    }
  }
  holdings.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1) || Number(a.network.testnet) - Number(b.network.testnet) || Number(!!a.token.custom) - Number(!!b.token.custom));

  // A USD total is only shown when every counted mainnet holding has a price. Custom tokens have
  // no verified price, so they're listed but never counted (the wallet says so).
  const counted = holdings.filter((h) => !h.network.testnet && !h.token.custom);
  const unpriced = counted.filter((h) => h.balance > 0n && h.usd === undefined);
  const totalUsd = counted.reduce((sum, h) => sum + (h.usd ?? 0), 0);
  const prevTotal = counted.reduce((sum, h) => {
    const p = priceOf(h.token);
    if (!h.usd || !p || p.change24h === null) return sum + (h.usd ?? 0);
    return sum + h.usd / (1 + p.change24h / 100);
  }, 0);

  return {
    statuses,
    holdings,
    prices,
    priceOf,
    allTokens,
    totalUsd: prices.status === "ok" && unpriced.length === 0 && statuses.some((s) => !s.network.testnet && s.status === "ok") ? totalUsd : null,
    change24h: prevTotal > 0 ? ((totalUsd - prevTotal) / prevTotal) * 100 : null,
    hasCustomHoldings: holdings.some((h) => h.token.custom && !h.network.testnet && h.balance > 0n),
    loading: statuses.some((s) => s.status === "loading"),
    failedNetworks: statuses.filter((s) => s.status === "error").map((s) => s.network),
    updatedAt,
    refresh,
    addCustomToken,
    removeCustomToken,
    balanceOf: (t: Pick<TokenInfo, "chainId" | "address">) => balances[tokenKey(t)],
  };
}

type Portfolio = ReturnType<typeof usePortfolioState> & { includeTestnets: boolean; setIncludeTestnets: (v: boolean) => void };
const Ctx = createContext<Portfolio | null>(null);

/** One shared balance/price reader for the Wallet tab, Send and anywhere else that needs it. */
export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { address, solanaAddress } = useWallet();
  const [includeTestnets, setIncludeTestnets] = useState(false);
  const state = usePortfolioState(address, solanaAddress, includeTestnets);
  return createElement(Ctx.Provider, { value: { ...state, includeTestnets, setIncludeTestnets } }, children);
}

export function usePortfolio() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePortfolio must be used inside PortfolioProvider");
  return v;
}

export function formatUsd(v: number) {
  if (v > 0 && v < 0.01) return "<$0.01";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
