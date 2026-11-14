import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui";

export const metadata: Metadata = { title: "Swap" };

export default function SwapPage() {
  return (
    <ComingSoon title="Swap" phase="Phase 2 (testnet) and Phase 3 (mainnet)">
      Swapping will use real routes from established aggregators. You will see the exchange rate, price impact, minimum received, gas
      and every fee before you sign. A token can only be swapped where a real route with enough liquidity exists.
    </ComingSoon>
  );
}
