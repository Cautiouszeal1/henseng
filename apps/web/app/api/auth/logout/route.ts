import { NextResponse, type NextRequest } from "next/server";
import { getDb, isDatabaseConfigured } from "@henseng/db";
import { assertSameOrigin } from "@/lib/http";
import { sessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const bad = assertSameOrigin(req);
  if (bad) return bad;
  const cookie = await sessionCookie();
  if (cookie.sid && isDatabaseConfigured()) {
    await getDb().session.updateMany({ where: { id: cookie.sid, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  cookie.destroy();
  return NextResponse.json({ ok: true });
}
