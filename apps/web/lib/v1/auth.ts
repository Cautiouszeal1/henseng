import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb, isDatabaseConfigured } from "@henseng/db";
import { error } from "./http";

export const APP_TOKEN_TTL_DAYS = 30;

export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface AppUser {
  userId: string;
  tokenId: string;
  address: string;
}

/**
 * Resolves "Authorization: Bearer <token>". Returns the user or a ready-made
 * 401/503 response. Updates lastUsedAt at most once a minute.
 */
export async function requireAppUser(req: NextRequest): Promise<{ user: AppUser } | { response: Response }> {
  if (!isDatabaseConfigured()) return { response: error(503, "DB_UNAVAILABLE", "The HENSENG API is not configured.") };
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { response: error(401, "UNAUTHENTICATED", "Sign in to continue.") };
  const db = getDb();
  const row = await db.appToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.revokedAt || row.expiresAt < new Date()) {
    return { response: error(401, "SESSION_EXPIRED", "Your session has ended. Sign in again.") };
  }
  const wallet = await db.wallet.findUnique({ where: { id: row.walletId } });
  if (!wallet) return { response: error(401, "SESSION_EXPIRED", "Your session has ended. Sign in again.") };
  if (Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.appToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return { user: { userId: row.userId, tokenId: row.id, address: wallet.address } };
}

/** Optional auth for public endpoints: returns the user when a valid token is sent. */
export async function optionalAppUser(req: NextRequest): Promise<AppUser | null> {
  if (!req.headers.get("authorization")) return null;
  const r = await requireAppUser(req);
  return "user" in r ? r.user : null;
}
