import { createPublicClient, http, type Hex } from "viem";
import { parseSiweMessage, verifySiweMessage, type SiweMessage } from "viem/siwe";
import { WALLET_CHAIN_IDS, walletChain } from "./chains";

export const NONCE_TTL_MS = 10 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type SiweCheck =
  | { ok: true; message: SiweMessage & { address: Hex; chainId: number; nonce: string } }
  | { ok: false; code: string; reason: string };

/**
 * Validates the structural fields of a Sign-In with Ethereum (EIP-4361)
 * message against what this site expects. The signature is checked separately.
 */
export function checkSiweFields(raw: string, expected: { siteUrl: string; now?: Date }): SiweCheck {
  let msg: Partial<SiweMessage>;
  try {
    msg = parseSiweMessage(raw);
  } catch {
    return { ok: false, code: "MALFORMED", reason: "The sign-in message could not be read." };
  }
  const site = new URL(expected.siteUrl);
  const now = expected.now ?? new Date();

  if (!msg.address || !msg.nonce || !msg.chainId || !msg.domain || !msg.uri) {
    return { ok: false, code: "MALFORMED", reason: "The sign-in message is missing required fields." };
  }
  if (msg.domain !== site.host) {
    return { ok: false, code: "BAD_DOMAIN", reason: `This message was created for ${msg.domain}, not ${site.host}.` };
  }
  if (new URL(msg.uri).origin !== site.origin) {
    return { ok: false, code: "BAD_URI", reason: "The sign-in message URI does not match this site." };
  }
  if (msg.version !== "1") {
    return { ok: false, code: "BAD_VERSION", reason: "Unsupported sign-in message version." };
  }
  if (!WALLET_CHAIN_IDS.has(msg.chainId)) {
    return { ok: false, code: "BAD_CHAIN", reason: "Sign in from a network HENSENG can connect to." };
  }
  if (msg.issuedAt && Math.abs(now.getTime() - msg.issuedAt.getTime()) > NONCE_TTL_MS + MAX_CLOCK_SKEW_MS) {
    return { ok: false, code: "STALE", reason: "This sign-in request has expired. Try again." };
  }
  if (msg.expirationTime && msg.expirationTime.getTime() < now.getTime()) {
    return { ok: false, code: "EXPIRED", reason: "This sign-in request has expired. Try again." };
  }
  if (msg.notBefore && msg.notBefore.getTime() > now.getTime() + MAX_CLOCK_SKEW_MS) {
    return { ok: false, code: "NOT_YET_VALID", reason: "This sign-in request is not valid yet." };
  }
  return { ok: true, message: msg as SiweMessage & { address: Hex; chainId: number; nonce: string } };
}

/**
 * Verifies the signature. Uses an RPC client so smart-contract wallets
 * (ERC-1271 / ERC-6492) verify correctly, not only EOAs.
 */
export async function verifySiweSignature(raw: string, signature: Hex, chainId: number, rpcUrl?: string) {
  const chain = walletChain(chainId);
  if (!chain) return false;
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  try {
    return await verifySiweMessage(client, { message: raw, signature });
  } catch {
    return false;
  }
}
