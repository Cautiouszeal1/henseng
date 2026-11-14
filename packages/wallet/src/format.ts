import { formatUnits } from "viem";

export function shortAddress(address: string, lead = 6, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/** Formats a base-unit amount for display, trimming to `maxDecimals` without rounding up. */
export function formatTokenAmount(value: bigint, decimals: number, maxDecimals = 6): string {
  const full = formatUnits(value, decimals);
  const [whole, frac = ""] = full.split(".");
  const trimmed = frac.slice(0, maxDecimals).replace(/0+$/, "");
  const wholeFmt = BigInt(whole!).toLocaleString("en-US");
  if (value > 0n && whole === "0" && !trimmed) return `<0.${"0".repeat(maxDecimals - 1)}1`;
  return trimmed ? `${wholeFmt}.${trimmed}` : wholeFmt;
}
