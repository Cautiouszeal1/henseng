import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "@henseng/db";
import { bootstrapAdminAddresses, rpcUrlFor, serverEnv } from "@/lib/env";
import { assertSameOrigin, clientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { SESSION_TTL_SECONDS, sessionCookie } from "@/lib/session";
import { checkSiweFields, verifySiweSignature } from "@/lib/siwe";

export const dynamic = "force-dynamic";

const body = z.object({
  message: z.string().min(1).max(4000),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

export async function POST(req: NextRequest) {
  const bad = assertSameOrigin(req);
  if (bad) return bad;
  if (!isDatabaseConfigured()) return jsonError(503, "DB_UNAVAILABLE", "Sign-in is unavailable: the database is not configured.");
  const { allowed } = await rateLimit(`verify:${clientIp(req)}`, 10, 60_000);
  if (!allowed) return jsonError(429, "RATE_LIMITED", "Too many sign-in attempts. Wait a minute and try again.");

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "BAD_REQUEST", "Send the signed message and signature.");
  const { message, signature } = parsed.data;

  const check = checkSiweFields(message, { siteUrl: serverEnv().NEXT_PUBLIC_SITE_URL });
  if (!check.ok) return jsonError(400, check.code, check.reason);
  const { address, chainId, nonce } = check.message;

  const db = getDb();
  // Consume the nonce atomically: only one request can succeed per nonce.
  const consumed = await db.authNonce.updateMany({
    where: { nonce, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) return jsonError(400, "BAD_NONCE", "This sign-in request was already used or has expired. Try again.");

  const valid = await verifySiweSignature(message, signature as `0x${string}`, chainId, rpcUrlFor(chainId));
  if (!valid) return jsonError(401, "BAD_SIGNATURE", "The signature does not match this wallet.");

  const lower = address.toLowerCase();
  const result = await db.$transaction(async (tx) => {
    let wallet = await tx.wallet.findUnique({ where: { namespace_address: { namespace: "EVM", address: lower } } });
    if (!wallet) {
      const user = await tx.user.create({ data: {} });
      wallet = await tx.wallet.create({ data: { userId: user.id, namespace: "EVM", address: lower } });
    }
    await tx.wallet.update({ where: { id: wallet.id }, data: { lastSignInAt: new Date() } });
    const session = await tx.session.create({
      data: {
        userId: wallet.userId,
        walletId: wallet.id,
        chainId,
        expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
        userAgent: req.headers.get("user-agent")?.slice(0, 255) ?? null,
      },
    });

    // Bootstrap: wallets listed in ADMIN_BOOTSTRAP_ADDRESSES become SUPER_ADMIN
    // on their first sign-in. Recorded in the audit log.
    if (bootstrapAdminAddresses().has(lower)) {
      const existing = await tx.adminUser.findUnique({ where: { userId: wallet.userId } });
      if (!existing) {
        const admin = await tx.adminUser.create({
          data: { userId: wallet.userId, roles: { create: [{ role: "SUPER_ADMIN" }] } },
        });
        await tx.adminAuditLog.create({
          data: {
            actorId: admin.id,
            action: "admin.bootstrap",
            entityType: "admin_user",
            entityId: admin.id,
            after: { address: lower, roles: ["SUPER_ADMIN"] },
            ip: clientIp(req),
          },
        });
      }
    }
    return { sessionId: session.id };
  });

  const cookie = await sessionCookie();
  cookie.sid = result.sessionId;
  await cookie.save();
  return NextResponse.json({ ok: true, address: lower, chainId });
}
