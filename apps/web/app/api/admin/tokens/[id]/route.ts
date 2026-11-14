import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@henseng/db";
import { requireAdminApi, writeAudit } from "@/lib/admin";
import { assertSameOrigin, clientIp, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const body = z
  .object({
    verificationStatus: z.enum(["UNVERIFIED", "PENDING_REVIEW", "VERIFIED", "REJECTED"]).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((b) => b.verificationStatus !== undefined || b.enabled !== undefined, "Nothing to change");

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const bad = assertSameOrigin(req);
  if (bad) return bad;
  const auth = await requireAdminApi("registry.tokens.write");
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "BAD_REQUEST", "Send verificationStatus and/or enabled.");

  const db = getDb();
  const result = await db.$transaction(async (tx) => {
    const before = await tx.token.findUnique({ where: { id } });
    if (!before) return { error: jsonError(404, "NOT_FOUND", "Token not found.") };

    const nextStatus = parsed.data.verificationStatus ?? before.verificationStatus;
    let nextEnabled = parsed.data.enabled ?? before.enabled;
    if (nextEnabled && nextStatus !== "VERIFIED") {
      return { error: jsonError(400, "NOT_VERIFIED", "Verify a token before enabling it.") };
    }
    if (nextStatus !== "VERIFIED") nextEnabled = false;

    const riskFlags =
      nextStatus === "VERIFIED" ? before.riskFlags.filter((f) => f !== "UNVERIFIED") : [...new Set([...before.riskFlags, "UNVERIFIED"])];

    const after = await tx.token.update({
      where: { id },
      data: { verificationStatus: nextStatus, enabled: nextEnabled, riskFlags },
    });
    await writeAudit(tx, {
      actorId: auth.admin.adminUserId,
      action: "token.update",
      entityType: "token",
      entityId: id,
      before: { verificationStatus: before.verificationStatus, enabled: before.enabled },
      after: { verificationStatus: after.verificationStatus, enabled: after.enabled },
      ip: clientIp(req),
    });
    return { token: after };
  });
  if ("error" in result) return result.error;
  return NextResponse.json({ ok: true, token: { id: result.token.id, verificationStatus: result.token.verificationStatus, enabled: result.token.enabled } });
}
