import { NextResponse } from "next/server";
import { listChains } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await listChains();
  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "public, max-age=30" },
  });
}
