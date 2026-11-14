import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui";

export const metadata: Metadata = { title: "Airdrop Hub" };

export default function AirdropsPage() {
  return (
    <ComingSoon title="Airdrop Hub" phase="Phase 4">
      A searchable list of airdrop and ecosystem campaigns, sourced from official project channels. Each listing will show when it was
      last verified, what is officially confirmed, and its risk warnings. Taking part never guarantees a reward.
    </ComingSoon>
  );
}
