import "server-only";
import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { generateSiweNonce } from "viem/siwe";
import {
  canChangeRole,
  canDeleteMessage,
  canManageCommunity,
  canModerate,
  canPost,
  MESSAGE_MAX_LENGTH,
  slugify,
  usernameProblem,
  type CommunityRole,
} from "@henseng/core";
import { getDb, type Prisma } from "@henseng/db";
import { rpcUrlFor, serverEnv } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { checkSiweFields, NONCE_TTL_MS, verifySiweSignature } from "@/lib/siwe";
import { APP_TOKEN_TTL_DAYS, newToken, requireAppUser, optionalAppUser, type AppUser } from "./auth";
import { error, ip, json, parseBody } from "./http";
import { personInclude, personView } from "./views";
import { ALLOWED_PRICE_IDS, getPrices } from "./prices";
import { getNfts, getTransfers, IndexerNotConfigured, INDEXED_NETWORKS } from "./indexer";
import { getQuote, getStatus, SwapError } from "./swap";

type Params = Record<string, string>;
export type Handler = (req: NextRequest, params: Params) => Promise<Response>;

const db = () => getDb();

async function authed(req: NextRequest, fn: (user: AppUser) => Promise<Response>): Promise<Response> {
  const r = await requireAppUser(req);
  if ("response" in r) return r.response;
  return fn(r.user);
}

async function limited(key: string, limit: number, windowMs: number): Promise<Response | null> {
  const { allowed } = await rateLimit(key, limit, windowMs);
  return allowed ? null : error(429, "RATE_LIMITED", "You're doing that too often. Wait a moment and try again.");
}

async function notify(userIds: string[], n: { kind: string; title: string; body?: string; link?: string }) {
  if (!userIds.length) return;
  await db().notification.createMany({ data: userIds.map((userId) => ({ userId, kind: n.kind, title: n.title, body: n.body ?? "", link: n.link })) });
}

/* ───────────────────────── Auth ───────────────────────── */

export const authNonce: Handler = async (req) => {
  const lim = await limited(`v1nonce:${ip(req)}`, 30, 60_000);
  if (lim) return lim;
  const nonce = generateSiweNonce();
  await db().authNonce.create({ data: { nonce, expiresAt: new Date(Date.now() + NONCE_TTL_MS) } });
  return json({ nonce, domain: new URL(serverEnv().NEXT_PUBLIC_SITE_URL).host, uri: serverEnv().NEXT_PUBLIC_SITE_URL });
};

const tokenBody = z.object({
  message: z.string().min(1).max(4000),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  platform: z.enum(["ios", "android", "web", "extension"]),
  deviceName: z.string().max(80).optional(),
});

/** Exchange a signed Sign-In with Ethereum message for an app token. */
export const authToken: Handler = async (req) => {
  const lim = await limited(`v1token:${ip(req)}`, 15, 60_000);
  if (lim) return lim;
  const body = await parseBody(req, tokenBody);
  if ("response" in body) return body.response;
  const { message, signature, platform, deviceName } = body.data;
  const check = checkSiweFields(message, { siteUrl: serverEnv().NEXT_PUBLIC_SITE_URL });
  if (!check.ok) return error(400, check.code, check.reason);
  const { address, chainId, nonce } = check.message;
  const consumed = await db().authNonce.updateMany({ where: { nonce, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
  if (consumed.count !== 1) return error(400, "BAD_NONCE", "This sign-in request was already used or has expired.");
  if (!(await verifySiweSignature(message, signature as `0x${string}`, chainId, rpcUrlFor(chainId)))) {
    return error(401, "BAD_SIGNATURE", "The signature does not match this wallet.");
  }
  const lower = address.toLowerCase();
  const { token, hash } = newToken();
  const result = await db().$transaction(async (tx) => {
    let wallet = await tx.wallet.findUnique({ where: { namespace_address: { namespace: "EVM", address: lower } } });
    if (!wallet) {
      const user = await tx.user.create({ data: {} });
      wallet = await tx.wallet.create({ data: { userId: user.id, namespace: "EVM", address: lower } });
    }
    await tx.profile.upsert({ where: { userId: wallet.userId }, update: {}, create: { userId: wallet.userId } });
    await tx.appToken.create({
      data: { userId: wallet.userId, walletId: wallet.id, tokenHash: hash, platform, deviceName: deviceName ?? null, expiresAt: new Date(Date.now() + APP_TOKEN_TTL_DAYS * 86_400_000) },
    });
    return wallet;
  });
  return json({ token, userId: result.userId, address: lower, expiresInDays: APP_TOKEN_TTL_DAYS });
};

export const authLogout: Handler = (req) =>
  authed(req, async (u) => {
    await db().appToken.update({ where: { id: u.tokenId }, data: { revokedAt: new Date() } });
    return json({ ok: true });
  });

/* ───────────────────────── Me, profiles, devices ───────────────────────── */

export const getMe: Handler = (req) =>
  authed(req, async (u) => {
    const user = await db().user.findUniqueOrThrow({ where: { id: u.userId }, include: personInclude });
    const unread = await db().notification.count({ where: { userId: u.userId, readAt: null } });
    return json({ ...personView(user), bio: user.profile?.bio ?? "", coverIndex: user.profile?.coverIndex ?? 0, showOnline: user.profile?.showOnline ?? true, unreadNotifications: unread });
  });

const profileBody = z.object({
  username: z.string().trim().toLowerCase().optional().nullable(),
  displayName: z.string().trim().max(40).optional(),
  bio: z.string().trim().max(160).optional(),
  avatarIndex: z.number().int().min(0).max(31).optional(),
  coverIndex: z.number().int().min(0).max(31).optional(),
  showOnline: z.boolean().optional(),
});

export const patchProfile: Handler = (req) =>
  authed(req, async (u) => {
    const body = await parseBody(req, profileBody);
    if ("response" in body) return body.response;
    const { username, ...rest } = body.data;
    const data: Prisma.ProfileUpdateInput = { ...rest };
    if (username !== undefined) {
      if (username) {
        const problem = usernameProblem(username);
        if (problem) return error(400, "BAD_USERNAME", problem);
        const taken = await db().profile.findUnique({ where: { username } });
        if (taken && taken.userId !== u.userId) return error(409, "USERNAME_TAKEN", `@${username} is already taken.`);
      }
      data.username = username || null;
    }
    const profile = await db().profile.upsert({ where: { userId: u.userId }, update: data, create: { userId: u.userId, ...(data as object) } });
    return json({ ok: true, username: profile.username });
  });

export const getProfile: Handler = async (_req, p) => {
  const profile = await db().profile.findUnique({ where: { username: p.username!.toLowerCase() }, include: { user: { include: personInclude } } });
  if (!profile) return error(404, "NOT_FOUND", "No one has that username.");
  return json({ ...personView(profile.user), bio: profile.bio });
};

const lookupBody = z.object({ addresses: z.array(z.string().regex(/^0x[0-9a-fA-F]{40}$/)).min(1).max(100) });

/** Resolves wallet addresses to public HENSENG profiles (used to show names in encrypted chats). */
export const lookupProfiles: Handler = async (req) => {
  const lim = await limited(`v1lookup:${ip(req)}`, 120, 60_000);
  if (lim) return lim;
  const body = await parseBody(req, lookupBody);
  if ("response" in body) return body.response;
  const wallets = await db().wallet.findMany({
    where: { namespace: "EVM", address: { in: body.data.addresses.map((a) => a.toLowerCase()) } },
    include: { user: { include: personInclude } },
  });
  return json({ profiles: Object.fromEntries(wallets.map((w) => [w.address, personView(w.user)])) });
};

export const listDevices: Handler = (req) =>
  authed(req, async (u) => {
    const rows = await db().appToken.findMany({ where: { userId: u.userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: "desc" } });
    return json({ devices: rows.map((r) => ({ id: r.id, platform: r.platform, deviceName: r.deviceName, createdAt: r.createdAt, lastUsedAt: r.lastUsedAt, current: r.id === u.tokenId })) });
  });

export const revokeDevice: Handler = (req, p) =>
  authed(req, async (u) => {
    const r = await db().appToken.updateMany({ where: { id: p.id, userId: u.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return r.count ? json({ ok: true }) : error(404, "NOT_FOUND", "That device is not signed in.");
  });

/* ───────────────────────── Communities ───────────────────────── */

async function membership(communityId: string, userId: string | undefined) {
  if (!userId) return null;
  return db().communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } });
}

function communityCard(c: { id: string; slug: string; name: string; tagline: string; category: string; visibility: string; avatarIndex: number; _count: { members: number } }, role: CommunityRole | null) {
  return { id: c.id, slug: c.slug, name: c.name, tagline: c.tagline, category: c.category, visibility: c.visibility, avatarIndex: c.avatarIndex, memberCount: c._count.members, joined: !!role, role };
}

export const listCommunities: Handler = async (req) => {
  const user = await optionalAppUser(req);
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const scope = url.searchParams.get("scope") ?? "discover";
  if (scope === "joined" && !user) return error(401, "UNAUTHENTICATED", "Sign in to see your communities.");
  const where: Prisma.CommunityWhereInput =
    scope === "joined"
      ? { members: { some: { userId: user!.userId } } }
      : { visibility: "PUBLIC", ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { tagline: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }] } : {}) };
  const rows = await db().community.findMany({ where, include: { _count: { select: { members: true } } }, orderBy: scope === "joined" ? { updatedAt: "desc" } : { members: { _count: "desc" } }, take: 50 });
  const roles = user ? await db().communityMember.findMany({ where: { userId: user.userId, communityId: { in: rows.map((r) => r.id) } } }) : [];
  return json({ communities: rows.map((c) => communityCard(c, (roles.find((m) => m.communityId === c.id)?.role as CommunityRole) ?? null)) });
};

const createBody = z.object({
  name: z.string().trim().min(3).max(48),
  tagline: z.string().trim().max(80).default(""),
  description: z.string().trim().max(1000).default(""),
  category: z.enum(["DeFi", "NFTs", "Builders", "Gaming", "DAO", "Education", "General"]).default("General"),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
});

export const createCommunity: Handler = (req) =>
  authed(req, async (u) => {
    const lim = await limited(`v1create:${u.userId}`, 5, 3_600_000);
    if (lim) return lim;
    const body = await parseBody(req, createBody);
    if ("response" in body) return body.response;
    const base = slugify(body.data.name) || "community";
    let slug = base;
    for (let i = 2; await db().community.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
    const c = await db().community.create({
      data: {
        ...body.data,
        slug,
        avatarIndex: Math.floor(Math.random() * 8),
        ownerId: u.userId,
        members: { create: { userId: u.userId, role: "OWNER" } },
        channels: { create: [{ name: "announcements", kind: "ANNOUNCEMENTS", postRole: "ADMIN", position: 0 }, { name: "general", position: 1 }] },
      },
    });
    return json({ slug: c.slug }, 201);
  });

export const getCommunity: Handler = async (req, p) => {
  const user = await optionalAppUser(req);
  const c = await db().community.findUnique({
    where: { slug: p.slug },
    include: { _count: { select: { members: true } }, channels: { orderBy: { position: "asc" } } },
  });
  if (!c) return error(404, "NOT_FOUND", "That community doesn't exist.");
  const me = await membership(c.id, user?.userId);
  const canSee = c.visibility === "PUBLIC" || !!me;
  const members = canSee
    ? await db().communityMember.findMany({ where: { communityId: c.id }, include: { user: { include: personInclude } }, orderBy: [{ role: "asc" }, { joinedAt: "asc" }], take: 24 })
    : [];
  const banned = user ? !!(await db().communityBan.findUnique({ where: { communityId_userId: { communityId: c.id, userId: user.userId } } })) : false;
  return json({
    ...communityCard(c, (me?.role as CommunityRole) ?? null),
    description: c.description,
    createdAt: c.createdAt,
    banned,
    canManage: canManageCommunity(me?.role as CommunityRole),
    channels: canSee ? c.channels.map((ch) => ({ id: ch.id, name: ch.name, kind: ch.kind, postRole: ch.postRole, canPost: canPost(me?.role as CommunityRole, ch.postRole as CommunityRole) })) : [],
    members: members.map((m) => ({ ...personView(m.user), role: m.role })),
  });
};

const joinBody = z.object({ inviteCode: z.string().max(40).optional() }).default({});

export const joinCommunity: Handler = (req, p) =>
  authed(req, async (u) => {
    const body = await parseBody(req, joinBody);
    if ("response" in body) return body.response;
    const c = await db().community.findUnique({ where: { slug: p.slug } });
    if (!c) return error(404, "NOT_FOUND", "That community doesn't exist.");
    if (await db().communityBan.findUnique({ where: { communityId_userId: { communityId: c.id, userId: u.userId } } })) {
      return error(403, "BANNED", "You can't join this community.");
    }
    if (await membership(c.id, u.userId)) return json({ ok: true, alreadyMember: true });
    if (c.visibility === "PRIVATE") {
      const code = body.data.inviteCode;
      const invite = code ? await db().communityInvite.findUnique({ where: { code } }) : null;
      if (!invite || invite.communityId !== c.id || (invite.expiresAt && invite.expiresAt < new Date()) || (invite.maxUses !== null && invite.uses >= invite.maxUses)) {
        return error(403, "INVITE_REQUIRED", "This is a private community. You need a valid invite link to join.");
      }
      await db().communityInvite.update({ where: { code: invite.code }, data: { uses: { increment: 1 } } });
    }
    await db().communityMember.create({ data: { communityId: c.id, userId: u.userId } });
    return json({ ok: true });
  });

export const leaveCommunity: Handler = (req, p) =>
  authed(req, async (u) => {
    const c = await db().community.findUnique({ where: { slug: p.slug } });
    if (!c) return error(404, "NOT_FOUND", "That community doesn't exist.");
    const me = await membership(c.id, u.userId);
    if (!me) return json({ ok: true });
    if (me.role === "OWNER") return error(400, "OWNER_CANNOT_LEAVE", "Transfer ownership before leaving your own community.");
    await db().communityMember.delete({ where: { communityId_userId: { communityId: c.id, userId: u.userId } } });
    return json({ ok: true });
  });

export const createInvite: Handler = (req, p) =>
  authed(req, async (u) => {
    const c = await db().community.findUnique({ where: { slug: p.slug } });
    if (!c) return error(404, "NOT_FOUND", "That community doesn't exist.");
    const me = await membership(c.id, u.userId);
    if (!me || (c.visibility === "PRIVATE" && !canManageCommunity(me.role as CommunityRole))) return error(403, "FORBIDDEN", "Only admins can create invites for a private community.");
    const code = randomBytes(9).toString("base64url");
    await db().communityInvite.create({ data: { code, communityId: c.id, createdById: u.userId, maxUses: 50, expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
    return json({ code, expiresInDays: 7, maxUses: 50 }, 201);
  });

/* ───────────────────────── Channel messages ───────────────────────── */

async function channelContext(slug: string, channelId: string, userId?: string) {
  const c = await db().community.findUnique({ where: { slug } });
  if (!c) return null;
  const ch = await db().communityChannel.findFirst({ where: { id: channelId, communityId: c.id } });
  if (!ch) return null;
  const me = await membership(c.id, userId);
  return { c, ch, me };
}

function messageView(m: { id: string; body: string; createdAt: Date; editedAt: Date | null; deletedAt: Date | null; replyToId: string | null; author: Parameters<typeof personView>[0] }, roles: Map<string, string>) {
  return {
    id: m.id,
    body: m.deletedAt ? null : m.body,
    deleted: !!m.deletedAt,
    createdAt: m.createdAt,
    editedAt: m.editedAt,
    replyToId: m.replyToId,
    author: { ...personView(m.author), role: roles.get(m.author.id) ?? null },
  };
}

export const listMessages: Handler = async (req, p) => {
  const user = await optionalAppUser(req);
  const ctx = await channelContext(p.slug!, p.channelId!, user?.userId);
  if (!ctx) return error(404, "NOT_FOUND", "That channel doesn't exist.");
  if (ctx.c.visibility === "PRIVATE" && !ctx.me) return error(403, "FORBIDDEN", "Join this community to read it.");
  const url = new URL(req.url);
  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");
  const rows = await db().channelMessage.findMany({
    where: { channelId: ctx.ch.id, ...(after ? { createdAt: { gt: new Date(after) } } : before ? { createdAt: { lt: new Date(before) } } : {}) },
    include: { author: { include: personInclude } },
    orderBy: { createdAt: after ? "asc" : "desc" },
    take: 50,
  });
  const ordered = after ? rows : rows.reverse();
  const roles = new Map((await db().communityMember.findMany({ where: { communityId: ctx.c.id, userId: { in: [...new Set(ordered.map((m) => m.authorId))] } } })).map((m) => [m.userId, m.role as string]));
  if (ctx.me) await db().communityMember.update({ where: { communityId_userId: { communityId: ctx.c.id, userId: user!.userId } }, data: { lastReadAt: new Date() } });
  return json({ messages: ordered.map((m) => messageView(m, roles)), encrypted: false });
};

const messageBody = z.object({ body: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH), replyToId: z.string().max(40).optional() });

export const postMessage: Handler = (req, p) =>
  authed(req, async (u) => {
    const lim = await limited(`v1msg:${u.userId}`, 20, 10_000);
    if (lim) return lim;
    const ctx = await channelContext(p.slug!, p.channelId!, u.userId);
    if (!ctx) return error(404, "NOT_FOUND", "That channel doesn't exist.");
    if (!ctx.me) return error(403, "NOT_MEMBER", "Join this community to post.");
    if (!canPost(ctx.me.role as CommunityRole, ctx.ch.postRole as CommunityRole)) return error(403, "FORBIDDEN", "Only admins can post in this channel.");
    const body = await parseBody(req, messageBody);
    if ("response" in body) return body.response;
    const m = await db().channelMessage.create({ data: { channelId: ctx.ch.id, authorId: u.userId, body: body.data.body, replyToId: body.data.replyToId ?? null }, include: { author: { include: personInclude } } });
    await db().community.update({ where: { id: ctx.c.id }, data: { updatedAt: new Date() } });
    if (ctx.ch.kind === "ANNOUNCEMENTS") {
      const others = await db().communityMember.findMany({ where: { communityId: ctx.c.id, userId: { not: u.userId } }, select: { userId: true } });
      await notify(others.map((o) => o.userId), { kind: "announcement", title: `New announcement in ${ctx.c.name}`, body: body.data.body.slice(0, 140), link: `/community/${ctx.c.slug}` });
    }
    return json({ message: messageView(m, new Map([[u.userId, ctx.me.role]])) }, 201);
  });

export const deleteMessage: Handler = (req, p) =>
  authed(req, async (u) => {
    const m = await db().channelMessage.findUnique({ where: { id: p.id }, include: { channel: true } });
    if (!m || m.deletedAt) return error(404, "NOT_FOUND", "That message doesn't exist.");
    const [actor, author] = await Promise.all([membership(m.channel.communityId, u.userId), membership(m.channel.communityId, m.authorId)]);
    if (!canDeleteMessage({ id: u.userId, role: actor?.role as CommunityRole }, { id: m.authorId, role: author?.role as CommunityRole })) {
      return error(403, "FORBIDDEN", "You can't delete this message.");
    }
    await db().channelMessage.update({ where: { id: m.id }, data: { deletedAt: new Date(), deletedById: u.userId } });
    return json({ ok: true });
  });

/* ───────────────────────── Moderation ───────────────────────── */

const roleBody = z.object({ role: z.enum(["ADMIN", "MODERATOR", "MEMBER"]) });

export const setRole: Handler = (req, p) =>
  authed(req, async (u) => {
    const body = await parseBody(req, roleBody);
    if ("response" in body) return body.response;
    const c = await db().community.findUnique({ where: { slug: p.slug } });
    if (!c) return error(404, "NOT_FOUND", "That community doesn't exist.");
    const [actor, target] = await Promise.all([membership(c.id, u.userId), membership(c.id, p.userId)]);
    if (!target) return error(404, "NOT_MEMBER", "That person isn't a member.");
    if (!canChangeRole(actor?.role as CommunityRole, target.role as CommunityRole, body.data.role)) return error(403, "FORBIDDEN", "You can't change this person's role.");
    await db().communityMember.update({ where: { communityId_userId: { communityId: c.id, userId: target.userId } }, data: { role: body.data.role } });
    await notify([target.userId], { kind: "role", title: `Your role in ${c.name} is now ${body.data.role.toLowerCase()}`, link: `/community/${c.slug}` });
    return json({ ok: true });
  });

const banBody = z.object({ reason: z.string().max(200).optional() }).default({});

export const banMember: Handler = (req, p) =>
  authed(req, async (u) => {
    const body = await parseBody(req, banBody);
    if ("response" in body) return body.response;
    const c = await db().community.findUnique({ where: { slug: p.slug } });
    if (!c) return error(404, "NOT_FOUND", "That community doesn't exist.");
    const [actor, target] = await Promise.all([membership(c.id, u.userId), membership(c.id, p.userId)]);
    if (!canModerate(actor?.role as CommunityRole, (target?.role as CommunityRole) ?? "MEMBER")) return error(403, "FORBIDDEN", "You can't remove this person.");
    await db().$transaction([
      db().communityMember.deleteMany({ where: { communityId: c.id, userId: p.userId } }),
      db().communityBan.upsert({ where: { communityId_userId: { communityId: c.id, userId: p.userId! } }, update: {}, create: { communityId: c.id, userId: p.userId!, bannedById: u.userId, reason: body.data.reason } }),
    ]);
    return json({ ok: true });
  });

/* ───────────────────────── Notifications and reports ───────────────────────── */

export const listNotifications: Handler = (req) =>
  authed(req, async (u) => {
    const rows = await db().notification.findMany({ where: { userId: u.userId }, orderBy: { createdAt: "desc" }, take: 50 });
    return json({ notifications: rows, unread: rows.filter((r) => !r.readAt).length });
  });

export const readNotifications: Handler = (req) =>
  authed(req, async (u) => {
    await db().notification.updateMany({ where: { userId: u.userId, readAt: null }, data: { readAt: new Date() } });
    return json({ ok: true });
  });

const reportBody = z.object({ targetType: z.enum(["message", "community", "user", "chat"]), targetId: z.string().min(1).max(100), reason: z.string().trim().min(3).max(500) });

export const createReport: Handler = (req) =>
  authed(req, async (u) => {
    const lim = await limited(`v1report:${u.userId}`, 10, 3_600_000);
    if (lim) return lim;
    const body = await parseBody(req, reportBody);
    if ("response" in body) return body.response;
    await db().report.create({ data: { reporterId: u.userId, ...body.data } });
    return json({ ok: true }, 201);
  });

/** USD prices for tokens in the wallet's curated list. Public; no account needed. */
export const listPrices: Handler = async (req) => {
  const lim = await limited(`v1prices:${ip(req)}`, 60, 60_000);
  if (lim) return lim;
  const ids = [...new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean))];
  if (!ids.length || ids.length > 50) return error(400, "BAD_REQUEST", "Pass 1 to 50 comma-separated price ids.");
  // Unknown ids are reported as missing rather than failing the request, so an app that
  // knows newer tokens still gets prices from an older server (and vice versa).
  const known = ids.filter((id) => ALLOWED_PRICE_IDS.has(id));
  const unknown = ids.filter((id) => !ALLOWED_PRICE_IDS.has(id));
  if (!known.length) return error(400, "BAD_REQUEST", `Unknown price id: ${unknown.join(", ")}`);
  const r = await getPrices(known);
  return json({ prices: r.prices, missing: [...r.missing, ...unknown], currency: "usd", source: "CoinGecko" });
};

/** Shared wrapper for indexer-backed endpoints: the signed-in user's own address, one network. */
const indexed = (load: (address: string, chainId: number) => Promise<unknown>): Handler => (req) =>
  authed(req, async (u) => {
    const lim = await limited(`v1idx:${u.userId}`, 60, 60_000);
    if (lim) return lim;
    const chainId = Number(req.nextUrl.searchParams.get("chainId"));
    if (!INDEXED_NETWORKS[chainId]) return error(400, "BAD_REQUEST", "Unsupported network.");
    try {
      return json(await load(u.address, chainId));
    } catch (e) {
      if (e instanceof IndexerNotConfigured) return error(503, "NOT_CONFIGURED", e.message);
      return error(502, "UPSTREAM", "Couldn't load this from the network right now. Try again shortly.");
    }
  });

export const walletTransfers = indexed(async (a, c) => ({ transfers: await getTransfers(a, c) }));
export const walletNfts = indexed((a, c) => getNfts(a, c));

const swapGuard = (fn: (req: Parameters<Handler>[0], address: string) => Promise<unknown>): Handler => (req) =>
  authed(req, async (u) => {
    const lim = await limited(`v1swap:${u.userId}`, 40, 60_000);
    if (lim) return lim;
    try {
      return json(await fn(req, u.address));
    } catch (e) {
      if (e instanceof SwapError) return error(e.status, e.code, e.message);
      throw e;
    }
  });

/** Swap or bridge quote for the signed-in user's own address (LI.FI, safety-checked). */
export const swapQuote = swapGuard((req, address) => {
  const q = req.nextUrl.searchParams;
  return getQuote(address, {
    fromChain: Number(q.get("fromChain")),
    toChain: Number(q.get("toChain")),
    fromToken: q.get("fromToken") ?? "",
    toToken: q.get("toToken") ?? "",
    fromAmount: q.get("fromAmount") ?? "",
    slippage: Number(q.get("slippage") ?? "0.005"),
  });
});

/** Progress of a cross-chain transfer. */
export const swapStatus = swapGuard((req) => {
  const q = req.nextUrl.searchParams;
  return getStatus(q.get("txHash") ?? "", Number(q.get("fromChain")), Number(q.get("toChain")), q.get("bridge") ?? "");
});

const deleteBody = z.object({ confirm: z.literal("DELETE") });
const ROLE_ORDER = ["ADMIN", "MODERATOR", "MEMBER"] as const;

/**
 * Deletes the signed-in account and everything HENSENG stores about it (required by the App
 * Store and Play Store). Communities the user owns pass to their most senior remaining member,
 * or are deleted if no one else is in them. The wallet itself is untouched: it lives on the
 * user's device and on the blockchain, which HENSENG can't (and shouldn't) change.
 */
export const deleteAccount: Handler = (req) =>
  authed(req, async (u) => {
    const lim = await limited(`v1delete:${u.userId}`, 3, 60_000);
    if (lim) return lim;
    const body = await parseBody(req, deleteBody);
    if ("response" in body) return body.response;
    if (await db().adminUser.findUnique({ where: { userId: u.userId } })) {
      return error(409, "ADMIN_ACCOUNT", "Admin accounts can't be deleted from the app. Remove admin access first.");
    }
    const summary = await db().$transaction(async (tx) => {
      let transferred = 0;
      let deleted = 0;
      for (const c of await tx.community.findMany({ where: { ownerId: u.userId }, select: { id: true } })) {
        const others = await tx.communityMember.findMany({ where: { communityId: c.id, userId: { not: u.userId } }, orderBy: { joinedAt: "asc" } });
        const heir = ROLE_ORDER.map((r) => others.find((m) => m.role === r)).find(Boolean);
        if (heir) {
          await tx.community.update({ where: { id: c.id }, data: { ownerId: heir.userId } });
          await tx.communityMember.update({ where: { communityId_userId: { communityId: c.id, userId: heir.userId } }, data: { role: "OWNER" } });
          transferred++;
        } else {
          await tx.community.delete({ where: { id: c.id } });
          deleted++;
        }
      }
      const messages = await tx.channelMessage.deleteMany({ where: { authorId: u.userId } });
      await tx.communityInvite.deleteMany({ where: { createdById: u.userId } });
      await tx.communityBan.deleteMany({ where: { userId: u.userId } });
      // Profile, wallet link, sessions, devices, memberships, notifications and own reports cascade.
      await tx.user.delete({ where: { id: u.userId } });
      return { communitiesTransferred: transferred, communitiesDeleted: deleted, messagesDeleted: messages.count };
    });
    return json({ deleted: true, ...summary });
  });
