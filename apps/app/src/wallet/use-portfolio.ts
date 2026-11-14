import { ERC20_ABI, PRICE_IDS, TOKENS, tokenKey, type TokenInfo } from "@henseng/wallet";
import { formatUnits } from "viem";
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { API_URL, useApi } from "../api/api-context";
import { NETWORKS, publicClient, type Network } from "./networks";
import { useWallet } from "./wallet-context";

export interface Holding {
  key: string;
  token: TokenInfo;
  network: Network;
  balance: bigint;
  /** USD value, only when a real price was available */
  usd?: number;
}

export interface NetworkStatus {
  network: Network;
  status: "loading" | "ok" | "error";
}

export interface Price {
  usd: number;
  change24h: number | null;
  stale: boolean;
}

export type PriceState = { status: "off" | "loading" | "error" } | { status: "ok"; prices: Record<string, Price>; updatedAt: Date };

/**
 * Reads native and curated token balances straight from each network (the user's
 * address never goes to HENSENG for this), and USD prices from the HENSENG API.
 * Native assets are always listed; tokens appear once they have a balance.
 */
function usePortfolioState(address: `0x${string}` | null, includeTestnets: boolean) {
  const { request } = useApi();
  const networks = NETWORKS.filter((n) => includeTestnets || !n.testnet);
  const [statuses, setStatuses] = useState<NetworkStatus[]>(networks.map((n) => ({ network: n, status: "loading" })));
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [prices, setPrices] = useState<PriceState>({ status: API_URL ? "loading" : "off" });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const run = useRef(0);

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

  const refresh = useCallback(() => {
    if (!address) return;
    const id = ++run.current;
    const list = NETWORKS.filter((n) => includeTestnets || !n.testnet);
    setStatuses(list.map((n) => ({ network: n, status: "loading" })));
    void loadPrices();
    void Promise.all(
      list.map(async (network) => {
        const client = publicClient(network.chain.id);
        const tokens = TOKENS.filter((t) => t.chainId === network.chain.id);
        try {
          const values = await Promise.all(
            tokens.map(async (t) => {
              if (!t.address) return [t, await client.getBalance({ address })] as const;
              // A single unreadable token shouldn't hide the rest of the network.
              const v = await client.readContract({ address: t.address, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }).catch(() => null);
              return [t, v] as const;
            }),
          );
          if (id !== run.current) return;
          setBalances((prev) => {
            const next = { ...prev };
            for (const [t, v] of values) if (v !== null) next[tokenKey(t)] = v;
            return next;
          });
          setStatuses((s) => s.map((x) => (x.network === network ? { network, status: "ok" } : x)));
        } catch {
          if (id !== run.current) return;
          setStatuses((s) => s.map((x) => (x.network === network ? { network, status: "error" } : x)));
        }
      }),
    ).then(() => id === run.current && setUpdatedAt(new Date()));
  }, [address, includeTestnets, loadPrices]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const priceOf = (t: TokenInfo) => (prices.status === "ok" && t.priceId ? prices.prices[t.priceId] : undefined);
  const holdings: Holding[] = [];
  for (const s of statuses) {
    if (s.status !== "ok") continue;
    for (const token of TOKENS.filter((t) => t.chainId === s.network.chain.id)) {
      const balance = balances[tokenKey(token)];
      if (balance === undefined || (token.address && balance === 0n)) continue;
      const p = priceOf(token);
      holdings.push({ key: tokenKey(token), token, network: s.network, balance, usd: p ? Number(formatUnits(balance, token.decimals)) * p.usd : undefined });
    }
  }
  holdings.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1) || Number(a.network.testnet) - Number(b.network.testnet));

  // A USD total is only shown when every mainnet holding we read has a price.
  const mainnetHoldings = holdings.filter((h) => !h.network.testnet);
  const unpriced = mainnetHoldings.filter((h) => h.balance > 0n && h.usd === undefined);
  const totalUsd = mainnetHoldings.reduce((sum, h) => sum + (h.usd ?? 0), 0);
  const prevTotal = mainnetHoldings.reduce((sum, h) => {
    const p = priceOf(h.token);
    if (!h.usd || !p || p.change24h === null) return sum + (h.usd ?? 0);
    return sum + h.usd / (1 + p.change24h / 100);
  }, 0);
  const change24h = prevTotal > 0 ? ((totalUsd - prevTotal) / prevTotal) * 100 : null;

  return {
    statuses,
    holdings,
    prices,
    priceOf,
    totalUsd: prices.status === "ok" && unpriced.length === 0 && statuses.some((s) => !s.network.testnet && s.status === "ok") ? totalUsd : null,
    change24h,
    loading: statuses.some((s) => s.status === "loading"),
    failedNetworks: statuses.filter((s) => s.status === "error").map((s) => s.network),
    updatedAt,
    refresh,
    balanceOf: (t: TokenInfo) => balances[tokenKey(t)],
  };
}

export function formatUsd(v: number) {
  if (v > 0 && v < 0.01) return "<$0.01";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Portfolio = ReturnType<typeof usePortfolioState> & { includeTestnets: boolean; setIncludeTestnets: (v: boolean) => void };
const Ctx = createContext<Portfolio | null>(null);

/** One shared balance/price reader for the Wallet tab, Send and anywhere else that needs it. */
export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  const [includeTestnets, setIncludeTestnets] = useState(false);
  const state = usePortfolioState(address, includeTestnets);
  return createElement(Ctx.Provider, { value: { ...state, includeTestnets, setIncludeTestnets } }, children);
}

export function usePortfolio() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePortfolio must be used inside PortfolioProvider");
  return v;
}
