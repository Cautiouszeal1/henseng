/**
 * Role-based access control for the admin area (spec §4, §15).
 * Permissions are checked on the server for every admin route and API call.
 */

export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "OPERATIONS_ADMIN",
  "CAMPAIGN_MANAGER",
  "ANALYST",
  "READ_ONLY_ADMIN",
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PERMISSIONS = [
  "admin.view",
  "registry.chains.write",
  "registry.tokens.write",
  "fees.write",
  "providers.write",
  "campaigns.write",
  "rewards.write",
  "users.manage",
  "roles.manage",
  "analytics.private.view",
  "audit.view",
  "settings.write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  OPERATIONS_ADMIN: [
    "admin.view",
    "registry.chains.write",
    "registry.tokens.write",
    "fees.write",
    "providers.write",
    "analytics.private.view",
    "audit.view",
  ],
  CAMPAIGN_MANAGER: ["admin.view", "campaigns.write", "rewards.write", "analytics.private.view"],
  ANALYST: ["admin.view", "analytics.private.view", "audit.view"],
  READ_ONLY_ADMIN: ["admin.view"],
};

export function permissionsFor(roles: readonly AdminRole[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) out.add(p);
  return out;
}

export function hasPermission(roles: readonly AdminRole[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}
