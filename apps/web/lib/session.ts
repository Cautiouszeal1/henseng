import "server-only";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { getDb, isDatabaseConfigured } from "@henseng/db";
import type { AdminRole } from "@henseng/core";
import { serverEnv } from "./env";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

type CookieData = { sid?: string };

function sessionOptions(): SessionOptions {
  const env = serverEnv();
  return {
    password: env.SESSION_SECRET,
    cookieName: "henseng_session",
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: env.NEXT_PUBLIC_SITE_URL.startsWith("https://"),
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function sessionCookie() {
  return getIronSession<CookieData>(await cookies(), sessionOptions());
}

export interface CurrentUser {
  userId: string;
  sessionId: string;
  address: string;
  chainId: number;
  adminRoles: AdminRole[];
}

/** Resolves the signed-in user from the cookie + server-side session row. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isDatabaseConfigured() || !process.env.SESSION_SECRET) return null;
  const cookie = await sessionCookie();
  if (!cookie.sid) return null;
  const db = getDb();
  const session = await db.session.findUnique({
    where: { id: cookie.sid },
    include: { user: { include: { wallets: true, admin: { include: { roles: true } } } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const wallet = session.user.wallets.find((w) => w.id === session.walletId);
  if (!wallet) return null;
  const admin = session.user.admin;
  return {
    userId: session.userId,
    sessionId: session.id,
    address: wallet.address,
    chainId: session.chainId,
    adminRoles: admin && !admin.disabledAt ? admin.roles.map((r) => r.role) : [],
  };
}
