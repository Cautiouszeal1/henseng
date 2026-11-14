import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@henseng/db";
import { requireAdminApi, writeAudit } from "@/lib/admin";
import { assertSameOrigin, clientIp, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const body = z.object({ enabled: z.boolean() });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const bad = assertSameOrigin(req);
  if (bad) return bad;
  const auth = await requireAdminApi("registry.chains.write");
  if (auth.error) return auth.error;

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return jsonError(400, "BAD_CHAIN_ID", "Chain ID must be a positive integer.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "BAD_REQUEST", "Send { enabled: true | false }.");

  const db = getDb();
  const updated = await db.$transaction(async (tx) => {
    const before = await tx.chain.findUnique({ where: { id } });
    if (!before) return null;
    const after = await tx.chain.update({ where: { id }, data: { enabled: parsed.data.enabled } });
    await writeAudit(tx, {
      actorId: auth.admin.adminUserId,
      action: parsed.data.enabled ? "chain.enable" : "chain.disable",
      entityType: "chain",
      entityId: String(id),
      before: { enabled: before.enabled },
      after: { enabled: after.enabled },
      ip: clientIp(req),
    });
    return after;
  });
  if (!updated) return jsonError(404, "NOT_FOUND", `Chain ${id} is not in the registry.`);
  return NextResponse.json({ ok: true, chain: { id: updated.id, enabled: updated.enabled } });
}
