import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "../api/api-context";
import { ApiError } from "../api/types";
import { NETWORKS } from "./networks";

/**
 * Transfer history and NFTs come from the HENSENG API's indexer (your own address only).
 * Solana history and NFTs aren't indexed yet.
 */
export interface IndexedTransfer {
  id: string;
  hash: string;
  chainId: number;
  direction: "in" | "out";
  kind: "native" | "token" | "nft";
  symbol: string | null;
  amount: string | null;
  decimals: number | null;
  tokenAddress: string | null;
  tokenId: string | null;
  verified: boolean;
  counterparty: string;
  timestamp: string | null;
}

export interface Nft {
  id: string;
  chainId: number;
  contract: string;
  tokenId: string;
  standard: "ERC721" | "ERC1155" | "UNKNOWN";
  balance: string;
  name: string;
  collection: string | null;
  description: string | null;
  image: string | null;
  thumbnail: string | null;
}

export type IndexerStatus = "off" | "loading" | "ok" | "partial" | "not_configured" | "error";

function useIndexed<T>(path: "transfers" | "nfts", includeTestnets: boolean, pick: (body: unknown) => { items: T[]; hidden?: number }) {
  const api = useApi();
  const [items, setItems] = useState<T[]>([]);
  const [hidden, setHidden] = useState(0);
  const [status, setStatus] = useState<IndexerStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const run = useRef(0);

  const load = useCallback(async () => {
    if (api.status !== "ready") {
      setStatus("off");
      return;
    }
    const id = ++run.current;
    setStatus((s) => (s === "ok" ? s : "loading"));
    const nets = NETWORKS.filter((n) => includeTestnets || !n.testnet);
    const results = await Promise.allSettled(nets.map((n) => api.request<unknown>("GET", `/wallet/${path}?chainId=${n.id}`)));
    if (id !== run.current) return;
    const ok = results.flatMap((r) => (r.status === "fulfilled" ? [pick(r.value)] : []));
    const failures = results.flatMap((r) => (r.status === "rejected" ? [r.reason] : []));
    if (failures.some((e) => e instanceof ApiError && e.code === "NOT_CONFIGURED")) {
      setStatus("not_configured");
      setMessage((failures.find((e) => e instanceof ApiError) as ApiError).message);
      return;
    }
    setItems(ok.flatMap((o) => o.items));
    setHidden(ok.reduce((n, o) => n + (o.hidden ?? 0), 0));
    setStatus(!ok.length ? "error" : failures.length ? "partial" : "ok");
    setMessage(failures[0] instanceof Error ? failures[0].message : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.status, api.request, includeTestnets, path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, hidden, status, message, reload: load };
}

export const useTransferHistory = (includeTestnets: boolean) =>
  useIndexed<IndexedTransfer>("transfers", includeTestnets, (b) => ({ items: (b as { transfers: IndexedTransfer[] }).transfers }));

export const useNfts = (includeTestnets: boolean) =>
  useIndexed<Nft>("nfts", includeTestnets, (b) => ({ items: (b as { nfts: Nft[] }).nfts, hidden: (b as { hiddenSpam: number }).hiddenSpam }));
