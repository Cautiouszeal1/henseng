import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui";

export const metadata: Metadata = { title: "Bridge" };

export default function BridgePage() {
  return (
    <ComingSoon title="Bridge" phase="Phase 3">
      Bridging will move assets between supported networks through vetted providers. Each transfer is tracked from the source
      transaction to confirmed delivery on the destination chain, and you get recovery guidance if anything is delayed.
    </ComingSoon>
  );
}
