import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { maxNetworkFee, paymentLink, parseAmountInput, parseEipNumber, parsePaymentText } from "./payment";
import { PRICE_IDS, TOKENS, findToken, tokenKey } from "./tokens";

const A = "0x52908400098527886E0F7030069857D2E4169EE7";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

describe("token list", () => {
  it("every address is a valid checksummed address", () => {
    for (const t of TOKENS) if (t.address?.startsWith("0x")) expect(getAddress(t.address)).toBe(t.address);
  });
  it("no duplicates per network", () => {
    const keys = TOKENS.map(tokenKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("testnet assets carry no price", () => {
    for (const t of TOKENS.filter((x) => [11155111, 84532, 103].includes(x.chainId))) expect(t.priceId).toBeUndefined();
  });
  it("finds tokens case-insensitively", () => {
    expect(findToken(8453, USDC_BASE.toLowerCase())?.symbol).toBe("USDC");
    expect(findToken(1, null)?.symbol).toBe("ETH");
    expect(PRICE_IDS).toContain("ethereum");
  });
});

describe("payment text", () => {
  it("plain address, any case", () => {
    expect(parsePaymentText(A.toLowerCase())).toEqual({ ok: true, request: { kind: "address", to: A } });
  });
  it("EIP-681 native with chain and value", () => {
    const r = parsePaymentText(`ethereum:${A}@8453?value=2.5e16`);
    expect(r).toEqual({ ok: true, request: { kind: "address", to: A, chainId: 8453, value: 25000000000000000n } });
  });
  it("EIP-681 token transfer", () => {
    const r = parsePaymentText(`ethereum:${USDC_BASE}@8453/transfer?address=${A}&uint256=1500000`);
    expect(r).toEqual({ ok: true, request: { kind: "token", token: USDC_BASE, to: A, chainId: 8453, amount: 1500000n } });
  });
  it("pay- prefix", () => {
    expect(parsePaymentText(`ethereum:pay-${A}`).ok).toBe(true);
  });
  it("rejects other chains, bad links and contract calls", () => {
    expect(parsePaymentText("bitcoin:bc1qxyz")).toMatchObject({ ok: false, reason: expect.stringContaining("Ethereum-network") });
    expect(parsePaymentText("hello").ok).toBe(false);
    expect(parsePaymentText("ethereum:0x123").ok).toBe(false);
    expect(parsePaymentText(`ethereum:${USDC_BASE}/approve?address=${A}&uint256=1`)).toMatchObject({ ok: false });
    expect(parsePaymentText(`ethereum:${A}?value=1.5`)).toMatchObject({ ok: false });
  });
  it("numbers", () => {
    expect(parseEipNumber("1e18")).toBe(10n ** 18n);
    expect(parseEipNumber("1.25e2")).toBe(125n);
    expect(parseEipNumber("1.255e2")).toBeNull();
    expect(parseEipNumber("abc")).toBeNull();
  });
  it("builds a receive link", () => {
    expect(paymentLink(A.toLowerCase(), 8453)).toBe(`ethereum:${A}@8453`);
  });
});

describe("amount input", () => {
  it("accepts normal entries", () => {
    expect(parseAmountInput("1", 18)).toEqual({ ok: true, value: 10n ** 18n });
    expect(parseAmountInput(".5", 6)).toEqual({ ok: true, value: 500000n });
    expect(parseAmountInput("1,000.25", 6)).toEqual({ ok: true, value: 1000250000n });
    expect(parseAmountInput("2.", 6)).toEqual({ ok: true, value: 2000000n });
  });
  it("rejects bad entries", () => {
    expect(parseAmountInput("", 6).ok).toBe(false);
    expect(parseAmountInput("0", 6).ok).toBe(false);
    expect(parseAmountInput("1.1234567", 6)).toMatchObject({ ok: false, reason: expect.stringContaining("6 decimal") });
    expect(parseAmountInput("-1", 6).ok).toBe(false);
    expect(parseAmountInput("1e5", 6).ok).toBe(false);
  });
  it("pads the fee", () => {
    expect(maxNetworkFee(21000n, 10n)).toBe(252000n);
  });
});
