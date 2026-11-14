import { createSiweMessage } from "viem/siwe";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
// Usage: start the web app (pnpm --filter @henseng/web start), then:
//   API_URL=http://localhost:3000 node apps/web/tests/api-v1.e2e.mjs
// Creates throwaway wallets; run against a development database only.
const B = `${process.env.API_URL ?? "http://localhost:3000"}/api/v1`;
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };
async function call(method, path, token, body) {
  const r = await fetch(B + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) };
}
async function login(acct, platform = "ios") {
  const n = (await call("POST", "/auth/nonce")).data;
  const message = createSiweMessage({ address: acct.address, chainId: 1, domain: n.domain, uri: n.uri, nonce: n.nonce, version: "1", issuedAt: new Date() });
  const signature = await acct.signMessage({ message });
  const r = await call("POST", "/auth/token", null, { message, signature, platform, deviceName: "Test device" });
  return { ...r, message, signature };
}
const A = privateKeyToAccount(generatePrivateKey()), Bw = privateKeyToAccount(generatePrivateKey()), C = privateKeyToAccount(generatePrivateKey());
const a = await login(A); const ta = a.data.token;
check("wallet A gets an app token", a.status === 200 && !!ta);
const replay = await call("POST", "/auth/token", null, { message: a.message, signature: a.signature, platform: "ios" });
check("replayed sign-in rejected", replay.status === 400, replay.data?.error?.code);
const forged = await call("POST", "/auth/token", null, { message: a.message.replace(A.address, Bw.address), signature: a.signature, platform: "ios" });
check("forged signature rejected", forged.status >= 400);
const tb = (await login(Bw, "android")).data.token; const tc = (await login(C, "web")).data.token;
check("no token → 401", (await call("GET", "/me")).status === 401);
check("bad token → 401", (await call("GET", "/me", "nope")).status === 401);

check("A sets username", (await call("PATCH", "/me/profile", ta, { username: "evans", displayName: "Evans E." })).status === 200);
const dup = await call("PATCH", "/me/profile", tb, { username: "evans" });
check("B can't take the same username", dup.status === 409, dup.data?.error?.message);
check("reserved username refused", (await call("PATCH", "/me/profile", tb, { username: "admin" })).status === 400);
check("B sets own username", (await call("PATCH", "/me/profile", tb, { username: "amara", displayName: "Amara" })).status === 200);
check("public profile lookup", (await call("GET", "/profiles/evans")).data?.displayName === "Evans E.");

const cr = await call("POST", "/communities", ta, { name: "Base Builders Lagos", tagline: "Shipping on Base", category: "Builders" });
check("A creates a public community", cr.status === 201 && cr.data.slug === "base-builders-lagos", cr.data?.slug);
const slug = cr.data.slug;
const detail = (await call("GET", `/communities/${slug}`, ta)).data;
check("creator is owner with 2 channels", detail.role === "OWNER" && detail.channels.length === 2);
const ann = detail.channels.find((c) => c.kind === "ANNOUNCEMENTS"); const gen = detail.channels.find((c) => c.name === "general");
check("public listing shows it", (await call("GET", "/communities?q=lagos")).data.communities.length === 1);
check("B can't post before joining", (await call("POST", `/communities/${slug}/channels/${gen.id}/messages`, tb, { body: "hi" })).status === 403);
check("B joins", (await call("POST", `/communities/${slug}/join`, tb, {})).status === 200);
check("C joins", (await call("POST", `/communities/${slug}/join`, tc, {})).status === 200);
const bm = await call("POST", `/communities/${slug}/channels/${gen.id}/messages`, tb, { body: "gm builders 👋" });
check("B posts in #general", bm.status === 201);
check("B can't post announcements", (await call("POST", `/communities/${slug}/channels/${ann.id}/messages`, tb, { body: "fake news" })).status === 403);
check("A posts an announcement", (await call("POST", `/communities/${slug}/channels/${ann.id}/messages`, ta, { body: "Demo day Friday 18:00" })).status === 201);
const nb = (await call("GET", "/notifications", tb)).data;
check("B is notified of the announcement", nb.unread === 1 && nb.notifications[0].title.includes("Base Builders Lagos"));
check("announcement does not notify its author", (await call("GET", "/notifications", ta)).data.unread === 0);
await call("POST", "/notifications/read", tb); check("mark notifications read", (await call("GET", "/notifications", tb)).data.unread === 0);
const msgs = (await call("GET", `/communities/${slug}/channels/${gen.id}/messages`)).data;
check("anyone can read a public channel; flagged not encrypted", msgs.messages.length === 1 && msgs.encrypted === false && msgs.messages[0].author.username === "amara");
check("C can't delete B's message", (await call("DELETE", `/messages/${bm.data.message.id}`, tc)).status === 403);
check("A promotes C to moderator", (await call("POST", `/communities/${slug}/members/${(await call("GET", "/me", tc)).data.id}/role`, ta, { role: "MODERATOR" })).status === 200);
check("C (moderator) can't make anyone admin", (await call("POST", `/communities/${slug}/members/${(await call("GET", "/me", tb)).data.id}/role`, tc, { role: "ADMIN" })).status === 403);
check("C (moderator) deletes B's message", (await call("DELETE", `/messages/${bm.data.message.id}`, tc)).status === 200);
check("deleted message shows as deleted", (await call("GET", `/communities/${slug}/channels/${gen.id}/messages`)).data.messages[0].deleted === true);
const bId = (await call("GET", "/me", tb)).data.id, aId = (await call("GET", "/me", ta)).data.id;
check("moderator can't ban the owner", (await call("POST", `/communities/${slug}/members/${aId}/ban`, tc, {})).status === 403);
check("moderator bans B", (await call("POST", `/communities/${slug}/members/${bId}/ban`, tc, { reason: "spam test" })).status === 200);
check("banned B can't rejoin", (await call("POST", `/communities/${slug}/join`, tb, {})).status === 403);
check("owner can't leave own community", (await call("POST", `/communities/${slug}/leave`, ta)).status === 400);

const pc = await call("POST", "/communities", ta, { name: "Core Team", visibility: "PRIVATE" });
const pslug = pc.data.slug;
check("private community hidden from public list", !(await call("GET", "/communities")).data.communities.some((c) => c.slug === pslug));
const pd = (await call("GET", `/communities/${pslug}`)).data;
check("non-members can't see private channels", pd.channels.length === 0 && pd.members.length === 0);
check("joining private without invite refused", (await call("POST", `/communities/${pslug}/join`, tc, {})).status === 403);
check("non-admin can't create private invite", (await call("POST", `/communities/${pslug}/invites`, tc)).status === 403);
const inv = await call("POST", `/communities/${pslug}/invites`, ta);
check("owner creates invite", inv.status === 201);
check("join private with invite", (await call("POST", `/communities/${pslug}/join`, tc, { inviteCode: inv.data.code })).status === 200);
check("joined list includes both", (await call("GET", "/communities?scope=joined", tc)).data.communities.length === 2);

const devs = (await call("GET", "/me/devices", ta)).data.devices;
check("devices list shows current", devs.length === 1 && devs[0].current);
const a2 = (await login(A, "web")).data.token;
const devs2 = (await call("GET", "/me/devices", a2)).data.devices;
const other = devs2.find((d) => !d.current);
check("revoke the other device", (await call("DELETE", `/me/devices/${other.id}`, a2)).status === 200);
check("revoked token no longer works", (await call("GET", "/me", ta)).status === 401);
check("report abuse", (await call("POST", "/reports", tc, { targetType: "message", targetId: bm.data.message.id, reason: "Spam link" })).status === 201);
check("logout revokes token", (await call("POST", "/auth/logout", tc)).status === 200 && (await call("GET", "/me", tc)).status === 401);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
