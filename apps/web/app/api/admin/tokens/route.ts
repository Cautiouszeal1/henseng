import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, erc20Abi, http } from "viem";
import { detectSymbolImpersonation, NATIVE_TOKEN_ADDRESS, normalizeAddress, tokenInputSchema } from "@henseng/core";
import { getDb } from "@henseng/db";
import { requireAdminApi, writeAudit } from "@/lib/admin";
import { walletChain } from "@/lib/chains";
import { rpcUrlFor } from "@/lib/env";
import { assertSameOrigin, clientIp, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Reads decimals and symbol from the contract to catch typos and fake entries. */
async function readOnChain(chainId: number, address: `0x${string}`) {
  const chain = walletChain(chainId);
  if (!chain) return { status: "skipped" as const };
  const client = createPublicClient({ chain, transport: http(rpcUrlFor(chainId), { timeout: 8_000 }) });
  try {
    const code = await client.getCode({ address });
    if (!code || code === "0x") return { status: "no_contract" as const };
    const [decimals, symbol] = await Promise.all([
      client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
      client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
    ]);
    return { status: "ok" as const, decimals, symbol };
  } catch {
    return { status: "unreachable" as const };
  }
}

export async function POST(req: NextRequest) {
  const bad = assertSameOrigin(req);
  if (bad) return bad;
  const auth = await requireAdminApi("registry.tokens.write");
  if (auth.error) return auth.error;

  const parsed = tokenInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "BAD_REQUEST", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  const input = parsed.data;
  const address = normalizeAddress(input.address);
  const lower = address.toLowerCase();

  const db = getDb();
  const chain = await db.chain.findUnique({ where: { id: input.chainId } });
  if (!chain) return jsonError(400, "UNKNOWN_CHAIN", `Chain ${input.chainId} is not in the registry. Add the chain first.`);

  const riskFlags = new Set<string>(["UNVERIFIED"]);
  if (lower !== NATIVE_TOKEN_ADDRESS) {
    const onChain = await readOnChain(input.chainId, address);
    if (onChain.status === "no_contract") {
      return jsonError(400, "NO_CONTRACT", `There is no contract at ${address} on ${chain.name}.`);
    }
    if (onChain.status === "unreachable" || onChain.status === "skipped") {
      // Could not read the contract: keep the token, but say so explicitly.
      riskFlags.add("ONCHAIN_UNCHECKED");
    }
    if (onChain.status === "ok") {
      if (onChain.decimals !== input.decimals) {
        return jsonError(400, "DECIMALS_MISMATCH", `The contract reports ${onChain.decimals} decimals, not ${input.decimals}.`);
      }
      if (onChain.symbol.trim().toUpperCase() !== input.symbol.trim().toUpperCase()) {
        riskFlags.add("SYMBOL_MISMATCH");
      }
    }
  }
  const verified = await db.token.findMany({
    where: { chainId: input.chainId, verificationStatus: "VERIFIED" },
    select: { chainId: true, address: true, symbol: true },
  });
  if (detectSymbolImpersonation({ chainId: input.chainId, address: lower, symbol: input.symbol }, verified)) {
    riskFlags.add("SYMBOL_IMPERSONATION");
  }

  const existing = await db.token.findUnique({ where: { chainId_address: { chainId: input.chainId, address: lower } } });
  if (existing) return jsonError(409, "DUPLICATE", `${existing.symbol} at this address is already in the registry.`);

  const token = await db.$transaction(async (tx) => {
    const created = await tx.token.create({
      data: {
        chainId: input.chainId,
        address: lower,
        symbol: input.symbol.trim(),
        name: input.name.trim(),
        decimals: input.decimals,
        logoUrl: input.logoUrl ?? null,
        verificationStatus: "PENDING_REVIEW",
        riskFlags: [...riskFlags],
        enabled: false,
        source: "admin",
      },
    });
    await writeAudit(tx, {
      actorId: auth.admin.adminUserId,
      action: "token.create",
      entityType: "token",
      entityId: created.id,
      after: { chainId: created.chainId, address: created.address, symbol: created.symbol, riskFlags: created.riskFlags },
      ip: clientIp(req),
    });
    return created;
  });
  return NextResponse.json({ ok: true, token: { id: token.id, riskFlags: token.riskFlags } }, { status: 201 });
}
