import { ed25519 } from "@noble/curves/ed25519.js";
import { address as kitAddress, getProgramDerivedAddress, getCompiledTransactionMessageDecoder, getTransactionDecoder, getBase58Encoder } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  associatedTokenAddress, ATA_PROGRAM, compileMessage, createAtaIdempotentInstruction, deriveSolanaKeypair, isOnCurve,
  isSolanaAddress, signTransaction, SOLANA_CLUSTERS, solTransferInstruction, SYSTEM_PROGRAM, TOKEN_PROGRAM, transferCheckedInstruction,
} from "./solana";

const ABOUT = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const BH = "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZAMdL4VZHirAn";
const USDC = SOLANA_CLUSTERS[0]!.usdcMint;

describe("solana keys", () => {
  it("matches the Phantom/Solflare derivation for the standard test phrase", () => {
    expect(deriveSolanaKeypair(ABOUT).address).toBe("HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk");
  });
  it("validates addresses", () => {
    expect(isSolanaAddress("HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk")).toBe(true);
    expect(isSolanaAddress("0x52908400098527886E0F7030069857D2E4169EE7")).toBe(false);
    expect(isSolanaAddress("HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpq0")).toBe(false);
    expect(isOnCurve("HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk")).toBe(true);
  });
});

describe("solana tokens", () => {
  it("token list mints match the cluster config and are valid addresses", async () => {
    const { TOKENS } = await import("./tokens");
    for (const c of SOLANA_CLUSTERS) {
      expect(TOKENS.find((t) => t.chainId === c.id && t.address)?.address).toBe(c.usdcMint);
      expect(isSolanaAddress(c.usdcMint)).toBe(true);
    }
  });
});

describe("associated token address", () => {
  it("matches @solana/kit's PDA derivation and is off-curve", async () => {
    const owner = "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk";
    const enc = getBase58Encoder();
    const [kit] = await getProgramDerivedAddress({ programAddress: kitAddress(ATA_PROGRAM), seeds: [enc.encode(owner), enc.encode(TOKEN_PROGRAM), enc.encode(USDC)] });
    expect(associatedTokenAddress(owner, USDC)).toBe(kit);
    expect(isOnCurve(kit)).toBe(false);
  });
});

describe("transactions", () => {
  const kp = deriveSolanaKeypair(ABOUT);
  const to = deriveSolanaKeypair(ABOUT, "m/44'/501'/1'/0'").address;
  const decode = (wire: Uint8Array) => {
    const tx = getTransactionDecoder().decode(wire);
    type Legacy = {
      staticAccounts: string[];
      header: { numSignerAccounts: number; numReadonlySignerAccounts: number; numReadonlyNonSignerAccounts: number };
      lifetimeToken: string;
      instructions: { programAddressIndex: number; accountIndices?: number[]; data?: Uint8Array }[];
    };
    const msg = getCompiledTransactionMessageDecoder().decode(tx.messageBytes) as unknown as Legacy;
    return { tx, msg };
  };

  it("SOL transfer decodes with @solana/kit and the signature verifies", () => {
    const m = compileMessage(kp.address, BH, [solTransferInstruction(kp.address, to, 1_500_000n)]);
    const { wire } = signTransaction(m, kp.secret);
    const { tx, msg } = decode(wire);
    expect(msg.staticAccounts).toEqual([kp.address, to, SYSTEM_PROGRAM]);
    expect(msg.header).toEqual({ numSignerAccounts: 1, numReadonlySignerAccounts: 0, numReadonlyNonSignerAccounts: 1 });
    expect(msg.lifetimeToken).toBe(BH);
    const ix = msg.instructions[0]!;
    expect(ix.programAddressIndex).toBe(2);
    expect(Array.from(ix.data!)).toEqual([2, 0, 0, 0, 0x60, 0xe3, 0x16, 0, 0, 0, 0, 0]);
    expect(ed25519.verify(tx.signatures[kp.address as never]!, new Uint8Array(tx.messageBytes), kp.publicKey)).toBe(true);
  });

  it("USDC transfer with token-account creation orders accounts correctly", () => {
    const m = compileMessage(kp.address, BH, [createAtaIdempotentInstruction(kp.address, to, USDC), transferCheckedInstruction(kp.address, USDC, to, 2_500_000n, 6)]);
    const { msg } = decode(signTransaction(m, kp.secret).wire);
    const keys = msg.staticAccounts;
    expect(keys[0]).toBe(kp.address);
    expect(msg.header.numSignerAccounts).toBe(1);
    // writable non-signers next: both token accounts
    expect(new Set(keys.slice(1, 3))).toEqual(new Set([associatedTokenAddress(to, USDC), associatedTokenAddress(kp.address, USDC)]));
    expect(new Set(keys.slice(3))).toEqual(new Set([to, USDC, SYSTEM_PROGRAM, TOKEN_PROGRAM, ATA_PROGRAM]));
    expect(msg.header.numReadonlyNonSignerAccounts).toBe(5);
    const transfer = msg.instructions[1]!;
    expect(keys[transfer.programAddressIndex]).toBe(TOKEN_PROGRAM);
    expect(transfer.data![0]).toBe(12);
    expect(transfer.data![9]).toBe(6);
    expect(transfer.accountIndices!.map((i) => keys[i])).toEqual([associatedTokenAddress(kp.address, USDC), USDC, associatedTokenAddress(to, USDC), kp.address]);
  });
});
