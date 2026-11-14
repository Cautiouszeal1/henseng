import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui";

export const metadata: Metadata = { title: "Leaderboard" };

export default function LeaderboardPage() {
  return (
    <ComingSoon title="Leaderboard" phase="Phase 4">
      HXP rankings built from the points ledger, with separate boards for testnet and mainnet. Activity flagged as wash trading or
      self-referral does not count.
    </ComingSoon>
  );
}
