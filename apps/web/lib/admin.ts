import "server-only";
import { redirect } from "next/navigation";
import { hasPermission, type Permission } from "@henseng/core";
import type { Prisma } from "@henseng/db";
import { getCurrentUser, type CurrentUser } from "./session";
import { jsonError } from "./http";

export type AdminContext = CurrentUser & { adminUserId: string };

async function loadAdmin(): Promise<AdminContext | null> {
  const user = await getCurrentUser();
  if (!user || user.adminRoles.length === 0) return null;
  const { getDb } = await import("@henseng/db");
  const admin = await getDb().adminUser.findUnique({ where: { userId: user.userId } });
  if (!admin || admin.disabledAt) return null;
  return { ...user, adminUserId: admin.id };
}

/** For admin pages: redirects anyone without the permission. */
export async function requireAdminPage(permission: Permission = "admin.view"): Promise<AdminContext> {
  const admin = await loadAdmin().catch(() => null);
  if (!admin) redirect("/admin/sign-in");
  if (!hasPermission(admin.adminRoles, permission)) redirect("/admin?denied=1");
  return admin;
}

/** For admin API routes: returns the admin or an error response. */
export async function requireAdminApi(
  permission: Permission,
): Promise<{ admin: AdminContext; error?: never } | { admin?: never; error: Response }> {
  const admin = await loadAdmin().catch(() => null);
  if (!admin) return { error: jsonError(401, "UNAUTHENTICATED", "Sign in with an admin wallet.") };
  if (!hasPermission(admin.adminRoles, permission)) {
    return { error: jsonError(403, "FORBIDDEN", "Your admin role does not allow this action.") };
  }
  return { admin };
}

export async function writeAudit(
  tx: Prisma.TransactionClient,
  entry: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    ip?: string;
  },
) {
  await tx.adminAuditLog.create({ data: entry });
}
