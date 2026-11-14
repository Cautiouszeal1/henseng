import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "./env";

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * CSRF protection for state-changing requests: the Origin header must match the
 * site origin. Session cookies are also SameSite=Lax.
 */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  const expected = new URL(serverEnv().NEXT_PUBLIC_SITE_URL).origin;
  if (!origin || origin !== expected) {
    return jsonError(403, "BAD_ORIGIN", "Request origin is not allowed.");
  }
  return null;
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
