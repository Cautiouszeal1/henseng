import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-28">
      <h1 className="text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-4 text-ink-muted">That address does not match any HENSENG page. Check the link, or go back to the homepage.</p>
      <ButtonLink href="/" variant="secondary" className="mt-8">Go to homepage</ButtonLink>
    </div>
  );
}
