import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DOCS, getDoc } from "@/lib/docs";

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = getDoc((await params).slug);
  return { title: doc?.title ?? "Documentation" };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const doc = getDoc((await params).slug);
  if (!doc) notFound();
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[13rem_1fr]">
      <nav aria-label="Documentation" className="text-sm">
        <Link href="/docs" className="text-ink-faint hover:text-ink">All guides</Link>
        <ul className="mt-4 space-y-2">
          {DOCS.map((d) => (
            <li key={d.slug}>
              <Link href={`/docs/${d.slug}`} aria-current={d.slug === doc.slug ? "page" : undefined} className={d.slug === doc.slug ? "text-ink" : "text-ink-muted hover:text-ink"}>
                {d.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="max-w-[68ch]">
        <h1 className="text-4xl font-semibold tracking-tight">{doc.title}</h1>
        <p className="mt-3 text-lg text-ink-muted">{doc.summary}</p>
        {doc.sections.map((s) => (
          <section key={s.heading} className="mt-10">
            <h2 className="text-xl font-semibold">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-3 text-ink-muted">{p}</p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
