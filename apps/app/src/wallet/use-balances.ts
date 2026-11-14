import { useCallback, useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { NETWORKS, type Network } from "./networks";

export type BalanceRow =
  | { network: Network; status: "loading" }
  | { network: Network; status: "ok"; wei: bigint }
  | { network: Network; status: "error"; message: string };

/**
 * Reads the native-asset balance on every supported network straight from
 * public RPC endpoints. Phase 3 switches to an indexer (token balances, prices
 * and history) behind the HENSENG API, with a server-side RPC key.
 */
export function useNativeBalances(address: `0x${string}` | null, includeTestnets: boolean) {
  const networks = NETWORKS.filter((n) => includeTestnets || !n.testnet);
  const [rows, setRows] = useState<BalanceRow[]>(networks.map((n) => ({ network: n, status: "loading" })));
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    if (!address) return;
    const list = NETWORKS.filter((n) => includeTestnets || !n.testnet);
    setRows(list.map((n) => ({ network: n, status: "loading" })));
    void Promise.all(
      list.map(async (network): Promise<BalanceRow> => {
        try {
          const client = createPublicClient({ chain: network.chain, transport: http(undefined, { timeout: 10_000, retryCount: 1 }) });
          const wei = await client.getBalance({ address });
          return { network, status: "ok", wei };
        } catch {
          return { network, status: "error", message: `Could not reach ${network.name}.` };
        }
      }),
    ).then((result) => {
      setRows(result);
      setUpdatedAt(new Date());
    });
  }, [address, includeTestnets]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rows, refresh, updatedAt };
}
