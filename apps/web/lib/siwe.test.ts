import { describe, expect, it } from "vitest";
import { createSiweMessage, generateSiweNonce } from "viem/siwe";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { checkSiweFields, verifySiweSignature } from "./siwe";

const siteUrl = "https://henseng.example";
const account = privateKeyToAccount(generatePrivateKey());

function message(over: Partial<Parameters<typeof createSiweMessage>[0]> = {}) {
  return createSiweMessage({
    address: account.address,
    chainId: 8453,
    domain: "henseng.example",
    uri: "https://henseng.example",
    nonce: generateSiweNonce(),
    version: "1",
    issuedAt: new Date(),
    statement: "Sign in to HENSENG.",
    ...over,
  });
}

describe("checkSiweFields", () => {
  it("accepts a well-formed message for this site", () => {
    expect(checkSiweFields(message(), { siteUrl }).ok).toBe(true);
  });

  it("rejects a message created for another domain (phishing relay)", () => {
    const r = checkSiweFields(message({ domain: "evil.example", uri: "https://evil.example" }), { siteUrl });
    expect(r).toMatchObject({ ok: false, code: "BAD_DOMAIN" });
  });

  it("rejects unsupported chains, expired and stale messages", () => {
    expect(checkSiweFields(message({ chainId: 56 }), { siteUrl })).toMatchObject({ ok: false, code: "BAD_CHAIN" });
    expect(checkSiweFields(message({ expirationTime: new Date(Date.now() - 1000) }), { siteUrl })).toMatchObject({ ok: false, code: "EXPIRED" });
    expect(checkSiweFields(message({ issuedAt: new Date(Date.now() - 60 * 60 * 1000) }), { siteUrl })).toMatchObject({ ok: false, code: "STALE" });
  });

  it("rejects garbage input", () => {
    expect(checkSiweFields("hello", { siteUrl }).ok).toBe(false);
  });
});

describe("verifySiweSignature", () => {
  // Uses a local signature. EOA verification in viem is done offline first; no RPC call is needed for a valid EOA signature.
  it("accepts the signer's signature and rejects another signer's", async () => {
    const raw = message();
    const good = await account.signMessage({ message: raw });
    const other = await privateKeyToAccount(generatePrivateKey()).signMessage({ message: raw });
    expect(await verifySiweSignature(raw, good, 8453, "http://127.0.0.1:1")).toBe(true);
    expect(await verifySiweSignature(raw, other, 8453, "http://127.0.0.1:1")).toBe(false);
  });
});
