import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui";

export const metadata: Metadata = { title: "Campaigns" };

export default function CampaignsPage() {
  return (
    <ComingSoon title="Campaigns" phase="Phase 4">
      Partner and creator campaigns with clear tasks and eligibility rules. Completions are labelled by how they were checked:
      self-reported, verified on-chain, or confirmed by the partner.
    </ComingSoon>
  );
}
