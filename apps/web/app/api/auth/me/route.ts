import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  return NextResponse.json(
    user ? { signedIn: true, address: user.address, chainId: user.chainId, isAdmin: user.adminRoles.length > 0 } : { signedIn: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
