import "server-only";
import { getDb, isDatabaseConfigured } from "@henseng/db";

export interface PublicChain {
  id: number;
  name: string;
  environment: "TESTNET" | "MAINNET";
  nativeSymbol: string;
  explorerUrl: string;
  logoUrl: string | null;
  /** true only when the chain is enabled AND at least one enabled provider integration has been verified on it */
  supported: boolean;
  swapProviders: string[];
  bridgeProviders: string[];
}

export type RegistryResult = { status: "ok"; chains: PublicChain[] } | { status: "unavailable"; reason: string };

export async function listChains(): Promise<RegistryResult> {
  if (!isDatabaseConfigured()) return { status: "unavailable", reason: "The registry database is not configured." };
  try {
    const rows = await getDb().chain.findMany({
      orderBy: [{ environment: "desc" }, { id: "asc" }],
      include: { providers: { include: { provider: true } } },
    });
    return {
      status: "ok",
      chains: rows.map((c) => {
        const live = c.providers.filter((p) => p.enabled && p.verifiedAt && p.provider.enabled);
        return {
          id: c.id,
          name: c.name,
          environment: c.environment,
          nativeSymbol: c.nativeSymbol,
          explorerUrl: c.explorerUrl,
          logoUrl: c.logoUrl,
          supported: c.enabled && live.length > 0,
          swapProviders: live.filter((p) => p.provider.kind === "SWAP").map((p) => p.provider.name),
          bridgeProviders: live.filter((p) => p.provider.kind === "BRIDGE").map((p) => p.provider.name),
        };
      }),
    };
  } catch {
    return { status: "unavailable", reason: "The registry could not be reached." };
  }
}
