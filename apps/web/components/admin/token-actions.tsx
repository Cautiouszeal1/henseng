"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

type Status = "UNVERIFIED" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED";

export function TokenActions({ id, status, enabled, disabled }: { id: string; status: Status; enabled: boolean; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/tokens/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error?.message ?? "Update failed.");
      return;
    }
    router.refresh();
  }

  if (disabled) return <span className="text-xs text-ink-faint">View only</span>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "VERIFIED" && (
        <Button variant="secondary" className="h-8 px-3 text-xs" disabled={busy} onClick={() => void patch({ verificationStatus: "VERIFIED" })}>
          Verify
        </Button>
      )}
      {status !== "REJECTED" && (
        <Button variant="danger" className="h-8 px-3 text-xs" disabled={busy} onClick={() => void patch({ verificationStatus: "REJECTED" })}>
          Reject
        </Button>
      )}
      {status === "VERIFIED" && (
        <Button variant={enabled ? "ghost" : "primary"} className="h-8 px-3 text-xs" disabled={busy} onClick={() => void patch({ enabled: !enabled })}>
          {enabled ? "Turn off" : "Turn on"}
        </Button>
      )}
      {error && <p role="alert" className="w-full text-xs text-danger">{error}</p>}
    </div>
  );
}
