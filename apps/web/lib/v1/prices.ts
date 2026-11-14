import "server-only";
import { PRICE_IDS } from "@henseng/wallet";

/**
 * USD prices for the wallet, from CoinGecko's public API, cached in memory.
 *
 * - Only ids from the wallet's curated token list are accepted.
 * - Fresh for 60 s; if CoinGecko fails, the last good price is served for up to
 *   15 minutes and marked stale. After that the price is reported missing, never invented.
 * - Set COINGECKO_API_KEY (a free "demo" key) for higher rate limits.
 *   PRICE_API_BASE overrides the endpoint (tests point it at a local fake).
 */
const FRESH_MS = 60_000;
const STALE_MS = 15 * 60_000;

export interface Price {
  usd: number;
  change24h: number | null;
  updatedAt: string;
  stale: boolean;
}

type Entry = { usd: number; change24h: number | null; fetchedAt: number };
const cache = new Map<string, Entry>();
let inflight: Promise<void> | null = null;

export const ALLOWED_PRICE_IDS = new Set(PRICE_IDS);

async function refresh(ids: string[]) {
  const base = process.env.PRICE_API_BASE || "https://api.coingecko.com/api/v3";
  const url = `${base}/simple/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=usd&include_24hr_change=true`;
  const key = process.env.COINGECKO_API_KEY;
  const res = await fetch(url, {
    headers: { accept: "application/json", ...(key ? { "x-cg-demo-api-key": key } : {}) },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Price source returned ${res.status}`);
  const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
  const now = Date.now();
  for (const id of ids) {
    const row = data[id];
    if (row && typeof row.usd === "number" && Number.isFinite(row.usd) && row.usd >= 0) {
      cache.set(id, { usd: row.usd, change24h: typeof row.usd_24h_change === "number" ? row.usd_24h_change : null, fetchedAt: now });
    }
  }
}

export async function getPrices(ids: string[]): Promise<{ prices: Record<string, Price>; missing: string[] }> {
  const now = Date.now();
  const needed = ids.filter((id) => !cache.has(id) || now - cache.get(id)!.fetchedAt > FRESH_MS);
  if (needed.length) {
    // One upstream call at a time; refresh every allowed id so concurrent callers share it.
    inflight ??= refresh([...ALLOWED_PRICE_IDS]).finally(() => (inflight = null));
    await inflight.catch(() => undefined);
  }
  const prices: Record<string, Price> = {};
  const missing: string[] = [];
  for (const id of ids) {
    const e = cache.get(id);
    const age = e ? Date.now() - e.fetchedAt : Infinity;
    if (!e || age > STALE_MS) missing.push(id);
    else prices[id] = { usd: e.usd, change24h: e.change24h, updatedAt: new Date(e.fetchedAt).toISOString(), stale: age > FRESH_MS };
  }
  return { prices, missing };
}
