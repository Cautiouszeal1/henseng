import { NextResponse } from "next/server";
import { getDb, isDatabaseConfigured } from "@henseng/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let database: "ok" | "not_configured" | "error" = "not_configured";
  if (isDatabaseConfigured()) {
    try {
      await getDb().$queryRaw`SELECT 1`;
      database = "ok";
    } catch {
      database = "error";
    }
  }
  const ok = database === "ok";
  return NextResponse.json({ ok, database, time: new Date().toISOString() }, { status: ok ? 200 : 503 });
}
