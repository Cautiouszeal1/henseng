import { NextResponse, type NextRequest } from "next/server";
import { generateSiweNonce } from "viem/siwe";
import { getDb, isDatabaseConfigured } from "@henseng/db";
import { clientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { NONCE_TTL_MS } from "@/lib/siwe";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return jsonError(503, "DB_UNAVAILABLE", "Sign-in is unavailable: the database is not configured.");
  const { allowed } = await rateLimit(`nonce:${clientIp(req)}`, 20, 60_000);
  if (!allowed) return jsonError(429, "RATE_LIMITED", "Too many sign-in attempts. Wait a minute and try again.");

  const nonce = generateSiweNonce();
  const db = getDb();
  await db.authNonce.create({ data: { nonce, expiresAt: new Date(Date.now() + NONCE_TTL_MS) } });
  // Opportunistic cleanup of expired nonces.
  await db.authNonce.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - NONCE_TTL_MS) } } });
  return NextResponse.json({ nonce }, { headers: { "Cache-Control": "no-store" } });
}
