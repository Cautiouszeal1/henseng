"use client";

import { Button } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-28">
      <h1 className="text-4xl font-semibold tracking-tight">This page failed to load</h1>
      <p className="mt-4 text-ink-muted">Something went wrong on our side. Your wallet and funds are not affected. Try loading it again.</p>
      <Button onClick={reset} className="mt-8">Try again</Button>
    </div>
  );
}
