import { normalize } from "viem/ens";
import { useCallback } from "react";
import { useApi } from "../api/api-context";
import type { Person } from "../api/types";
import { parseTarget } from "../messaging/model";
import { publicClient } from "./networks";

export type Resolved = { address: `0x${string}`; label: string; person?: Person } | { error: string };

/**
 * Turns what a person typed into an address: a 0x address, an ENS name (looked up on
 * Ethereum) or a HENSENG @username (looked up on the HENSENG API). Used by Send and Chats.
 */
export function useResolveRecipient() {
  const api = useApi();
  return useCallback(
    async (input: string): Promise<Resolved> => {
      const t = parseTarget(input);
      if (t.type === "invalid") return { error: t.reason };
      if (t.type === "address") return { address: t.value, label: t.value };
      if (t.type === "ens") {
        try {
          const a = await publicClient(1).getEnsAddress({ name: normalize(t.value) });
          return a ? { address: a.toLowerCase() as `0x${string}`, label: t.value } : { error: `${t.value} doesn't point to an address.` };
        } catch {
          return { error: "Couldn't look up that ENS name. Check your connection." };
        }
      }
      if (api.status !== "ready") return { error: "Usernames need the HENSENG server. Use a wallet address instead." };
      try {
        const p = await api.request<Person>("GET", `/profiles/${t.value}`);
        if (!p.address) return { error: `@${t.value} has no wallet linked.` };
        return { address: p.address.toLowerCase() as `0x${string}`, label: `@${t.value}`, person: p };
      } catch {
        return { error: `No one on HENSENG is called @${t.value}.` };
      }
    },
    [api],
  );
}
