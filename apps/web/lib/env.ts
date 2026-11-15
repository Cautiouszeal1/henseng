import "server-only";
import { z } from "zod";

/**
 * Server environment, validated lazily so that `next build` works without
 * secrets. Any route that needs a value calls serverEnv() and fails clearly.
 */
/** On Vercel, the project's production domain (e.g. https://henseng.vercel.app) unless set explicitly. */
export function defaultSiteUrl() {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

const schema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  NEXT_PUBLIC_SITE_URL: z.url().default(defaultSiteUrl()),
  ADMIN_BOOTSTRAP_ADDRESSES: z.string().default(""),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  cached = parsed.data;
  return cached;
}

export function bootstrapAdminAddresses(): Set<string> {
  return new Set(
    serverEnv()
      .ADMIN_BOOTSTRAP_ADDRESSES.split(",")
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Server-only RPC URL for a chain, if configured. */
export function rpcUrlFor(chainId: number): string | undefined {
  const v = process.env[`RPC_URL_${chainId}`];
  return v && v.length > 0 ? v : undefined;
}
