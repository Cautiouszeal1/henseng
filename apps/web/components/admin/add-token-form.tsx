"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Panel } from "@/components/ui";

const field = "mt-1.5 h-10 w-full rounded-[var(--radius-control)] border border-rule-strong bg-deeper px-3 text-sm text-ink placeholder:text-ink-faint";

export function AddTokenForm({ chains }: { chains: { id: number; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainId: Number(form.get("chainId")),
        address: String(form.get("address")).trim(),
        symbol: String(form.get("symbol")).trim(),
        name: String(form.get("name")).trim(),
        decimals: Number(form.get("decimals")),
      }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setMessage({ tone: "error", text: data?.error?.message ?? "Could not add the token." });
      return;
    }
    const flags: string[] = data.token.riskFlags.filter((f: string) => f !== "UNVERIFIED");
    setMessage({ tone: "ok", text: flags.length ? `Token added with risk flags: ${flags.join(", ")}.` : "Token added. It is pending review." });
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <Panel className="mt-8 p-6">
      <h2 className="font-semibold">Add a token</h2>
      <form onSubmit={onSubmit} className="mt-4 grid gap-4 md:grid-cols-[10rem_1fr_7rem_1fr_6rem_auto] md:items-end">
        <label className="text-sm text-ink-muted">
          Chain
          <select name="chainId" required className={field}>
            {chains.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-ink-muted">
          Contract address
          <input name="address" required pattern="^0x[0-9a-fA-F]{40}$" placeholder="0x…" className={field} autoComplete="off" spellCheck={false} />
        </label>
        <label className="text-sm text-ink-muted">
          Symbol
          <input name="symbol" required maxLength={16} className={field} />
        </label>
        <label className="text-sm text-ink-muted">
          Name
          <input name="name" required maxLength={64} className={field} />
        </label>
        <label className="text-sm text-ink-muted">
          Decimals
          <input name="decimals" required type="number" min={0} max={36} defaultValue={18} className={field} />
        </label>
        <Button type="submit" disabled={busy}>{busy ? "Checking contract…" : "Add token"}</Button>
      </form>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`mt-4 text-sm ${message.tone === "error" ? "text-danger" : "text-signal"}`}>
          {message.text}
        </p>
      )}
    </Panel>
  );
}
