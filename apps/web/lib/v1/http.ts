import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";

/**
 * /api/v1 is the super app API (iOS, Android, web app, extension). It uses
 * bearer tokens, never cookies, so cross-origin access is safe to allow and
 * CSRF does not apply.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "600",
};

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
}

export function error(status: number, code: string, message: string) {
  return json({ error: { code, message } }, status);
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<{ data: T } | { response: NextResponse }> {
  const raw = await req.json().catch(() => null);
  try {
    return { data: schema.parse(raw) };
  } catch (e) {
    const msg = e instanceof ZodError ? e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") : "Invalid request.";
    return { response: error(400, "BAD_REQUEST", msg) };
  }
}

export function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
