"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ChainToggle({ chainId, name, enabled, disabled }: { chainId: number; name: string; enabled: boolean; disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    const res = await fetch(`/api/admin/chains/${chainId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error?.message ?? "Could not update the chain.");
      return;
    }
    start(() => router.refresh());
  }

  return (
    <div>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label={`${enabled ? "Disable" : "Enable"} ${name}`}
        onClick={() => void toggle()}
        disabled={disabled || pending}
        title={disabled ? "Your role cannot change chains" : undefined}
        className={`relative h-6 w-11 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          enabled ? "border-volt bg-volt" : "border-rule-strong bg-deeper"
        }`}
      >
        <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-ink transition-transform ${enabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
