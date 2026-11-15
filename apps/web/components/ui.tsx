import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* Shared primitives. Kept small on purpose: one button, one badge, one panel. */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 h-10 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-volt text-white hover:bg-volt-hover",
  secondary: "border border-rule-strong text-ink hover:bg-deeper",
  ghost: "text-ink-muted hover:text-ink hover:bg-deeper",
  danger: "border border-danger/50 text-danger hover:bg-danger/10",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={clsx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={clsx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

/** A button-styled plain link, for pages outside the Next.js app such as the HENSENG web app at /app. */
export function ButtonAnchor({ variant = "primary", className, ...props }: ComponentProps<"a"> & { variant?: ButtonVariant }) {
  return <a className={clsx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

type Tone = "neutral" | "mainnet" | "testnet" | "live" | "warn" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "border-rule-strong text-ink-muted",
  mainnet: "border-volt/50 text-[#9db8ff]",
  testnet: "border-violet/50 text-[#c2b3ff]",
  live: "border-signal/50 text-signal",
  warn: "border-warn/50 text-warn",
  danger: "border-danger/50 text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Panel({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-[var(--radius-panel)] border border-rule bg-deep", className)} {...props} />;
}

export function ComingSoon({ title, phase, children }: { title: string; phase: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <Badge tone="warn">Not available yet</Badge>
      <h1 className="mt-5 text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-4 max-w-[60ch] text-ink-muted">{children}</p>
      <p className="mt-6 text-sm text-ink-faint">Planned for {phase}. Nothing on this page works until it ships.</p>
      <ButtonLink href="/" variant="secondary" className="mt-10">
        Back to home
      </ButtonLink>
    </div>
  );
}
