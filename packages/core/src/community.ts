/**
 * Community roles and permission rules (super app, spec module 2).
 * Pure functions: every API route calls these, and they are unit-tested.
 */

export const COMMUNITY_ROLES = ["OWNER", "ADMIN", "MODERATOR", "MEMBER"] as const;
export type CommunityRole = (typeof COMMUNITY_ROLES)[number];

const RANK: Record<CommunityRole, number> = { OWNER: 4, ADMIN: 3, MODERATOR: 2, MEMBER: 1 };

export function roleRank(role: CommunityRole | null | undefined): number {
  return role ? RANK[role] : 0;
}

export function atLeast(role: CommunityRole | null | undefined, min: CommunityRole): boolean {
  return roleRank(role) >= RANK[min];
}

/** Posting in a channel: members only, and at least the channel's post role. Banned users are never members. */
export function canPost(role: CommunityRole | null | undefined, channelPostRole: CommunityRole): boolean {
  return atLeast(role, channelPostRole);
}

/** Deleting a message: its author, or a moderator+ who outranks the author. */
export function canDeleteMessage(
  actor: { id: string; role: CommunityRole | null | undefined },
  author: { id: string; role: CommunityRole | null | undefined },
): boolean {
  if (actor.id === author.id) return true;
  return atLeast(actor.role, "MODERATOR") && roleRank(actor.role) > roleRank(author.role);
}

/** Removing or banning someone: moderator+ and strictly higher rank. Nobody can ban the owner. */
export function canModerate(actorRole: CommunityRole | null | undefined, targetRole: CommunityRole | null | undefined): boolean {
  if (targetRole === "OWNER") return false;
  return atLeast(actorRole, "MODERATOR") && roleRank(actorRole) > roleRank(targetRole);
}

/**
 * Changing a role: admin+, only for people ranked below you, and only to a
 * role below your own. Ownership transfer is a separate, explicit action.
 */
export function canChangeRole(actorRole: CommunityRole | null | undefined, targetRole: CommunityRole, newRole: CommunityRole): boolean {
  if (newRole === "OWNER" || targetRole === "OWNER") return false;
  if (!atLeast(actorRole, "ADMIN")) return false;
  return roleRank(actorRole) > roleRank(targetRole) && roleRank(actorRole) > roleRank(newRole);
}

export function canManageCommunity(role: CommunityRole | null | undefined): boolean {
  return atLeast(role, "ADMIN");
}

/** URL-safe slug from a community name, e.g. "Web3 Builders!" → "web3-builders". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

const RESERVED_USERNAMES = new Set(["admin", "henseng", "support", "help", "security", "official", "team", "moderator", "system", "root"]);

export function usernameProblem(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) return "Use 3–20 characters: lowercase letters, numbers and _.";
  if (RESERVED_USERNAMES.has(username) || username.startsWith("henseng")) return "That username is reserved.";
  return null;
}

export const MESSAGE_MAX_LENGTH = 4000;
