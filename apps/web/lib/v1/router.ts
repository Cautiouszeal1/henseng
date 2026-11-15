import "server-only";
import type { NextRequest } from "next/server";
import * as h from "./handlers";
import { error } from "./http";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** Route table for /api/v1. Segments starting with ":" are parameters. */
const ROUTES: [Method, string, h.Handler][] = [
  ["POST", "auth/nonce", h.authNonce],
  ["POST", "auth/token", h.authToken],
  ["POST", "auth/logout", h.authLogout],
  ["GET", "me", h.getMe],
  ["PATCH", "me/profile", h.patchProfile],
  ["GET", "me/devices", h.listDevices],
  ["DELETE", "me/devices/:id", h.revokeDevice],
  ["DELETE", "me", h.deleteAccount],
  ["POST", "profiles/lookup", h.lookupProfiles],
  ["GET", "profiles/:username", h.getProfile],
  ["GET", "communities", h.listCommunities],
  ["POST", "communities", h.createCommunity],
  ["GET", "communities/:slug", h.getCommunity],
  ["POST", "communities/:slug/join", h.joinCommunity],
  ["POST", "communities/:slug/leave", h.leaveCommunity],
  ["POST", "communities/:slug/invites", h.createInvite],
  ["GET", "communities/:slug/channels/:channelId/messages", h.listMessages],
  ["POST", "communities/:slug/channels/:channelId/messages", h.postMessage],
  ["POST", "communities/:slug/members/:userId/role", h.setRole],
  ["POST", "communities/:slug/members/:userId/ban", h.banMember],
  ["DELETE", "messages/:id", h.deleteMessage],
  ["GET", "notifications", h.listNotifications],
  ["POST", "notifications/read", h.readNotifications],
  ["POST", "reports", h.createReport],
  ["GET", "prices", h.listPrices],
  ["GET", "wallet/transfers", h.walletTransfers],
  ["GET", "wallet/nfts", h.walletNfts],
  ["GET", "swap/quote", h.swapQuote],
  ["GET", "swap/status", h.swapStatus],
];

export function match(method: Method, segments: string[]): { handler: h.Handler; params: Record<string, string> } | null {
  for (const [m, pattern, handler] of ROUTES) {
    if (m !== method) continue;
    const parts = pattern.split("/");
    if (parts.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const seg = segments[i]!;
      if (part.startsWith(":")) params[part.slice(1)] = decodeURIComponent(seg);
      else if (part !== seg) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler, params };
  }
  return null;
}

export async function dispatch(method: Method, req: NextRequest, segments: string[]): Promise<Response> {
  const found = match(method, segments);
  if (!found) return error(404, "NOT_FOUND", "Unknown API endpoint.");
  try {
    return await found.handler(req, found.params);
  } catch (e) {
    console.error("[api/v1]", method, segments.join("/"), e);
    return error(500, "SERVER_ERROR", "Something went wrong on our side. Try again.");
  }
}
