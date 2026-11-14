import type { Metadata } from "next";
import Link from "next/link";
import { DOCS, PLANNED_DOCS } from "@/lib/docs";

export const metadata: Metadata = { title: "Documentation" };

export default function DocsIndex() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Documentation</h1>
      <p className="mt-4 max-w-[60ch] text-ink-muted">Guides to using HENSENG safely. New guides are added as each feature ships.</p>
      <ul className="mt-12 divide-y divide-rule border-y border-rule">
        {DOCS.map((d) => (
          <li key={d.slug}>
            <Link href={`/docs/${d.slug}`} className="group grid gap-1 py-6 md:grid-cols-[16rem_1fr] md:gap-8">
              <span className="font-medium group-hover:text-volt-hover">{d.title}</span>
              <span className="text-ink-muted">{d.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="mt-16 text-lg font-semibold">Coming with later releases</h2>
      <p className="mt-3 max-w-[70ch] text-sm text-ink-faint">{PLANNED_DOCS.join(", ")}.</p>
    </div>
  );
}
