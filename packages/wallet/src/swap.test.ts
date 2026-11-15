import { describe, expect, it } from "vitest";
import { checkQuote, LIFI_DIAMOND, NATIVE_TOKEN, valueLossPercent, type QuoteExpectation, type SwapQuote } from "./swap";

const ME = "0x52908400098527886E0F7030069857D2E4169EE7";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const base = (over: Partial<SwapQuote> = {}, tx: Partial<SwapQuote["tx"]> = {}): SwapQuote => ({
  id: "q", tool: "uniswap", toolName: "Uniswap", fromChain: 8453, toChain: 8453, fromToken: USDC, toToken: NATIVE_TOKEN,
  fromAmount: "1000000", toAmount: "300000000000000", toAmountMin: "298000000000000", fromAmountUsd: 1, toAmountUsd: 0.98,
  gasUsd: 0.01, fees: [], approvalAddress: LIFI_DIAMOND, durationSec: 30,
  tx: { to: LIFI_DIAMOND, from: ME.toLowerCase(), data: "0xdeadbeef00", value: "0x0", chainId: 8453, gasLimit: null, ...tx }, ...over,
});
const exp = (over: Partial<QuoteExpectation> = {}): QuoteExpectation => ({ fromChain: 8453, toChain: 8453, fromToken: USDC, toToken: NATIVE_TOKEN, fromAmount: "1000000", fromAddress: ME, ...over });

describe("checkQuote", () => {
  it("accepts a well-formed token quote", () => expect(checkQuote(base(), exp())).toBeNull());
  it("accepts native ETH with matching value", () => {
    const q = base({ fromToken: NATIVE_TOKEN, toToken: USDC, approvalAddress: null, fromAmount: (10n ** 18n).toString() }, { value: "0xde0b6b3a7640000" });
    expect(checkQuote(q, exp({ fromToken: NATIVE_TOKEN, toToken: USDC, fromAmount: (10n ** 18n).toString() }))).toBeNull();
  });
  it("refuses an unknown target contract", () => expect(checkQuote(base({}, { to: "0x000000000000000000000000000000000000dEaD" }), exp())).toMatch(/unknown contract/));
  it("refuses an unknown approval spender", () => expect(checkQuote(base({ approvalAddress: "0x000000000000000000000000000000000000dEaD" }), exp())).toMatch(/approve an unknown/));
  it("refuses ETH value on a token swap", () => expect(checkQuote(base({}, { value: "1" }), exp())).toMatch(/different amount of ETH/));
  it("refuses wrong value on an ETH swap", () => {
    const q = base({ fromToken: NATIVE_TOKEN, toToken: USDC, approvalAddress: null, fromAmount: "6" }, { value: "5" });
    expect(checkQuote(q, exp({ fromToken: NATIVE_TOKEN, toToken: USDC, fromAmount: "6" }))).toMatch(/different amount of ETH/);
  });
  it("refuses wrong chain, sender, amount or tokens", () => {
    expect(checkQuote(base({}, { chainId: 1 }), exp())).toMatch(/network/);
    expect(checkQuote(base({}, { from: "0x000000000000000000000000000000000000dEaD" }), exp())).toMatch(/your address/);
    expect(checkQuote(base({ fromAmount: "2" }), exp())).toMatch(/amount/);
    expect(checkQuote(base({ toToken: USDC }), exp())).toMatch(/tokens/);
    expect(checkQuote(base({ fromChain: 56 }), exp())).toMatch(/Unsupported/);
  });
  it("refuses a zero or inconsistent minimum", () => {
    expect(checkQuote(base({ toAmountMin: "0" }), exp())).toMatch(/minimum/);
    expect(checkQuote(base({ toAmountMin: "9", toAmount: "1" }), exp())).toMatch(/minimum/);
  });
  it("computes value loss", () => {
    expect(valueLossPercent({ fromAmountUsd: 100, toAmountUsd: 97 })).toBeCloseTo(3);
    expect(valueLossPercent({ fromAmountUsd: null, toAmountUsd: 1 })).toBeNull();
  });
});
