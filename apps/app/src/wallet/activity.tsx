import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { publicClient } from "./networks";
import { usePortfolio } from "./use-portfolio";
import { useWallet } from "./wallet-context";

/**
 * Transactions sent from HENSENG on this device, with live status.
 * Stored locally per wallet (public data only: hashes, amounts, addresses).
 * Incoming transfers and activity from other apps need an indexer (later phase).
 */
export interface ActivityItem {
  hash: `0x${string}`;
  chainId: number;
  kind: "send";
  symbol: string;
  decimals: number;
  amount: string; // base units as a string (bigint isn't JSON-safe)
  to: `0x${string}`;
  toLabel?: string;
  createdAt: number;
  status: "pending" | "confirmed" | "failed";
  /** Max fee shown at review time (wei) */
  maxFee?: string;
}

interface ActivityApi {
  items: ActivityItem[];
  add: (item: Omit<ActivityItem, "createdAt" | "status">) => void;
  /** Addresses this wallet has sent to before (lower-case). */
  knownRecipients: Set<string>;
  get: (hash: string) => ActivityItem | undefined;
}

const Ctx = createContext<ActivityApi | null>(null);
const keyFor = (address: string) => `henseng.activity.v1.${address.toLowerCase()}`;
const POLL_MS = 4_000;

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  const { refresh: refreshBalances } = usePortfolio();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    setItems([]);
    loadedFor.current = null;
    if (!address) return;
    void AsyncStorage.getItem(keyFor(address)).then((raw) => {
      loadedFor.current = address;
      if (raw) setItems(JSON.parse(raw) as ActivityItem[]);
    });
  }, [address]);

  useEffect(() => {
    if (address && loadedFor.current === address) void AsyncStorage.setItem(keyFor(address), JSON.stringify(items.slice(0, 200)));
  }, [items, address]);

  // Follow pending transactions until the network confirms or rejects them.
  const pending = items.filter((i) => i.status === "pending");
  const pendingKey = pending.map((p) => p.hash).join(",");
  useEffect(() => {
    if (!pendingKey) return;
    const tick = async () => {
      for (const p of items.filter((i) => i.status === "pending")) {
        try {
          const r = await publicClient(p.chainId).getTransactionReceipt({ hash: p.hash });
          const status = r.status === "success" ? "confirmed" : "failed";
          setItems((list) => list.map((i) => (i.hash === p.hash ? { ...i, status } : i)));
          refreshBalances(); // the fee was spent either way
        } catch {
          // Not mined yet (or the network is unreachable); try again on the next tick.
        }
      }
    };
    void tick();
    const t = setInterval(() => void tick(), POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  const add = useCallback<ActivityApi["add"]>((item) => {
    setItems((list) => [{ ...item, createdAt: Date.now(), status: "pending" }, ...list.filter((i) => i.hash !== item.hash)]);
  }, []);

  const value = useMemo<ActivityApi>(
    () => ({ items, add, knownRecipients: new Set(items.map((i) => i.to.toLowerCase())), get: (hash) => items.find((i) => i.hash === hash) }),
    [items, add],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActivity() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useActivity must be used inside ActivityProvider");
  return v;
}
