import { describe, expect, it } from "vitest";
import {
  decryptVault,
  deriveEvmAccount,
  encryptVault,
  formatTokenAmount,
  generateMnemonic,
  isEncryptedVault,
  isValidMnemonic,
  normalizeMnemonic,
  passwordProblems,
  pickConfirmationPositions,
  shortAddress,
  unknownWords,
  WrongPasswordError,
} from "./index";

// Fast KDF params for tests only; production uses DEFAULT_KDF.
const FAST = { N: 2 ** 10, r: 8, p: 1 };

// Official BIP-39 / Hardhat test vector — public, holds no funds.
const TEST_MNEMONIC = "test test test test test test test test test test test junk";

describe("mnemonic", () => {
  it("generates valid, unique 12- and 24-word phrases", () => {
    const a = generateMnemonic();
    const b = generateMnemonic();
    expect(a.split(" ")).toHaveLength(12);
    expect(generateMnemonic(24).split(" ")).toHaveLength(24);
    expect(isValidMnemonic(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("derives the standard Ethereum address (m/44'/60'/0'/0/0)", () => {
    expect(deriveEvmAccount(TEST_MNEMONIC).address).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    expect(deriveEvmAccount(TEST_MNEMONIC, 1).address).toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  });

  it("accepts messy input but rejects bad checksums and unknown words", () => {
    expect(isValidMnemonic(`  ${TEST_MNEMONIC.toUpperCase().replaceAll(" ", "   ")} `)).toBe(true);
    expect(normalizeMnemonic(" A  b ")).toBe("a b");
    expect(isValidMnemonic(TEST_MNEMONIC.replace("junk", "test"))).toBe(false);
    expect(unknownWords("test tset junk")).toEqual(["tset"]);
  });

  it("picks distinct confirmation positions within range", () => {
    const pos = pickConfirmationPositions(12, 3);
    expect(new Set(pos).size).toBe(3);
    expect(pos.every((p) => p >= 1 && p <= 12)).toBe(true);
  });
});

describe("vault", () => {
  const payload = { mnemonic: TEST_MNEMONIC, accountCount: 1, createdAt: "2026-11-14T00:00:00.000Z" };

  it("round-trips with the right password and never contains the phrase in clear text", async () => {
    const vault = await encryptVault(payload, "correct horse 42", FAST);
    expect(isEncryptedVault(vault)).toBe(true);
    expect(JSON.stringify(vault)).not.toContain("junk");
    expect(await decryptVault(vault, "correct horse 42")).toEqual(payload);
  });

  it("rejects a wrong password and tampered ciphertext", async () => {
    const vault = await encryptVault(payload, "correct horse 42", FAST);
    await expect(decryptVault(vault, "wrong horse 42")).rejects.toBeInstanceOf(WrongPasswordError);
    const flipped = vault.ciphertext.slice(0, -2) + (vault.ciphertext.endsWith("00") ? "01" : "00");
    await expect(decryptVault({ ...vault, ciphertext: flipped }, "correct horse 42")).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it("uses a fresh salt and nonce every time", async () => {
    const a = await encryptVault(payload, "pw12345678", FAST);
    const b = await encryptVault(payload, "pw12345678", FAST);
    expect(a.salt).not.toBe(b.salt);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("checks password strength", () => {
    expect(passwordProblems("short1")).toHaveLength(1);
    expect(passwordProblems("longenough")).toEqual(["Mix letters and numbers."]);
    expect(passwordProblems("longenough9")).toEqual([]);
  });
});

describe("format", () => {
  it("shortens addresses and formats token amounts without rounding up", () => {
    expect(shortAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")).toBe("0xf39F…2266");
    expect(formatTokenAmount(1_234_567_890_000_000_000_000n, 18)).toBe("1,234.56789");
    expect(formatTokenAmount(1n, 18)).toBe("<0.000001");
    expect(formatTokenAmount(0n, 18)).toBe("0");
    expect(formatTokenAmount(1_999_999n, 6, 2)).toBe("1.99");
  });
});
