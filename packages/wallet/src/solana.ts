/**
 * Solana support built on audited primitives (@noble/curves ed25519, @noble/hashes,
 * @scure/base). No Solana SDK at runtime: it keeps the bundle small and works on
 * iOS/Android without WebCrypto Ed25519 polyfills.
 *
 * Keys: SLIP-10 ed25519 at m/44'/501'/0'/0', the path Phantom, Solflare and Backpack
 * use, so the same recovery phrase opens the same Solana account in those wallets.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { base58 } from "@scure/base";
import { mnemonicToSeedSync } from "@scure/bip39";
import { normalizeMnemonic } from "./mnemonic";

export const SOLANA_PATH = "m/44'/501'/0'/0'";
export const LAMPORTS_PER_SOL = 1_000_000_000n;
/** Minimum balance a plain (data-less) Solana account must hold to exist. */
export const RENT_EXEMPT_MIN_LAMPORTS = 890_880n;
/** Fee per signature on Solana (the base fee; we never add priority fees). */
export const LAMPORTS_PER_SIGNATURE = 5_000n;

export const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

/** Pseudo chain ids (the ones Solana token lists use) so Solana fits alongside EVM ids. */
export const SOLANA_MAINNET_ID = 101;
export const SOLANA_DEVNET_ID = 103;

export interface SolanaCluster {
  id: number;
  name: string;
  testnet: boolean;
  rpc: string;
  explorerQuery: string;
  /** USDC mint on this cluster (Circle) */
  usdcMint: string;
}

export const SOLANA_CLUSTERS: SolanaCluster[] = [
  { id: SOLANA_MAINNET_ID, name: "Solana", testnet: false, rpc: "https://api.mainnet-beta.solana.com", explorerQuery: "", usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { id: SOLANA_DEVNET_ID, name: "Solana Devnet", testnet: true, rpc: "https://api.devnet.solana.com", explorerQuery: "?cluster=devnet", usdcMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" },
];

export const solanaCluster = (id: number) => SOLANA_CLUSTERS.find((c) => c.id === id);
export const isSolanaChain = (id: number) => id === SOLANA_MAINNET_ID || id === SOLANA_DEVNET_ID;
export const solanaExplorerTx = (id: number, sig: string) => `https://explorer.solana.com/tx/${sig}${solanaCluster(id)?.explorerQuery ?? ""}`;
export const solanaExplorerAddress = (id: number, a: string) => `https://explorer.solana.com/address/${a}${solanaCluster(id)?.explorerQuery ?? ""}`;

/* ───────── Keys and addresses ───────── */

export interface SolanaKeypair {
  address: string;
  publicKey: Uint8Array;
  /** 32-byte ed25519 seed; never leaves the device */
  secret: Uint8Array;
}

function slip10Ed25519(seed: Uint8Array, path: string): Uint8Array {
  const segments = path.split("/").slice(1);
  let I = hmac(sha512, new TextEncoder().encode("ed25519 seed"), seed);
  let key = I.slice(0, 32);
  let chain = I.slice(32);
  for (const seg of segments) {
    if (!seg.endsWith("'")) throw new Error("ed25519 derivation supports hardened indexes only");
    const index = (Number(seg.slice(0, -1)) | 0x80000000) >>> 0;
    const data = new Uint8Array(37);
    data[0] = 0;
    data.set(key, 1);
    new DataView(data.buffer).setUint32(33, index, false);
    I = hmac(sha512, chain, data);
    key = I.slice(0, 32);
    chain = I.slice(32);
  }
  return key;
}

export function deriveSolanaKeypair(mnemonic: string, path = SOLANA_PATH): SolanaKeypair {
  const secret = slip10Ed25519(mnemonicToSeedSync(normalizeMnemonic(mnemonic)), path);
  const publicKey = ed25519.getPublicKey(secret);
  return { address: base58.encode(publicKey), publicKey, secret };
}

export function isSolanaAddress(s: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim())) return false;
  try {
    return base58.decode(s.trim()).length === 32;
  } catch {
    return false;
  }
}

/** True for addresses on the ed25519 curve, i.e. ones with a private key (wallets). PDAs are off-curve. */
export function isOnCurve(address: string): boolean {
  try {
    ed25519.Point.fromBytes(base58.decode(address));
    return true;
  } catch {
    return false;
  }
}

export function findProgramAddress(seeds: Uint8Array[], programId: string): string {
  const program = base58.decode(programId);
  const marker = new TextEncoder().encode("ProgramDerivedAddress");
  for (let bump = 255; bump >= 0; bump--) {
    const parts = [...seeds, Uint8Array.of(bump), program, marker];
    const buf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) {
      buf.set(p, o);
      o += p.length;
    }
    const hash = sha256(buf);
    try {
      ed25519.Point.fromBytes(hash);
    } catch {
      return base58.encode(hash); // off-curve → valid PDA
    }
  }
  throw new Error("No program address found");
}

/** The token account that holds `mint` for `owner` (associated token account). */
export function associatedTokenAddress(owner: string, mint: string): string {
  return findProgramAddress([base58.decode(owner), base58.decode(TOKEN_PROGRAM), base58.decode(mint)], ATA_PROGRAM);
}

/* ───────── Transactions (legacy format) ───────── */

export interface AccountMeta {
  address: string;
  signer: boolean;
  writable: boolean;
}
export interface Instruction {
  programId: string;
  accounts: AccountMeta[];
  data: Uint8Array;
}

function shortvec(n: number): number[] {
  const out: number[] = [];
  let v = n;
  for (;;) {
    let b = v & 0x7f;
    v >>= 7;
    if (v) b |= 0x80;
    out.push(b);
    if (!v) return out;
  }
}
const u64le = (v: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, v, true);
  return b;
};

/** Compiles instructions into a legacy message with `feePayer` first. */
export function compileMessage(feePayer: string, recentBlockhash: string, instructions: Instruction[]): Uint8Array {
  const metas = new Map<string, AccountMeta>();
  const order: string[] = [];
  const touch = (m: AccountMeta) => {
    const prev = metas.get(m.address);
    if (prev) {
      prev.signer ||= m.signer;
      prev.writable ||= m.writable;
    } else {
      metas.set(m.address, { ...m });
      order.push(m.address);
    }
  };
  touch({ address: feePayer, signer: true, writable: true });
  for (const ix of instructions) {
    ix.accounts.forEach(touch);
    touch({ address: ix.programId, signer: false, writable: false });
  }
  const rank = (m: AccountMeta) => (m.signer ? (m.writable ? 0 : 1) : m.writable ? 2 : 3);
  const keys = order
    .map((a, i) => ({ m: metas.get(a)!, i }))
    .sort((x, y) => (x.m.address === feePayer ? -1 : y.m.address === feePayer ? 1 : rank(x.m) - rank(y.m) || x.i - y.i))
    .map((x) => x.m);
  const index = new Map(keys.map((k, i) => [k.address, i]));
  const bytes: number[] = [
    keys.filter((k) => k.signer).length,
    keys.filter((k) => k.signer && !k.writable).length,
    keys.filter((k) => !k.signer && !k.writable).length,
    ...shortvec(keys.length),
  ];
  for (const k of keys) bytes.push(...base58.decode(k.address));
  const bh = base58.decode(recentBlockhash);
  if (bh.length !== 32) throw new Error("Invalid blockhash");
  bytes.push(...bh, ...shortvec(instructions.length));
  for (const ix of instructions) {
    bytes.push(index.get(ix.programId)!, ...shortvec(ix.accounts.length), ...ix.accounts.map((a) => index.get(a.address)!), ...shortvec(ix.data.length), ...ix.data);
  }
  return Uint8Array.from(bytes);
}

/** Signs a message with one keypair (single-signer transactions) and returns wire bytes + signature. */
export function signTransaction(message: Uint8Array, secret: Uint8Array): { wire: Uint8Array; signature: string } {
  const sig = ed25519.sign(message, secret);
  const wire = new Uint8Array(1 + 64 + message.length);
  wire[0] = 1;
  wire.set(sig, 1);
  wire.set(message, 65);
  return { wire, signature: base58.encode(sig) };
}

export function solTransferInstruction(from: string, to: string, lamports: bigint): Instruction {
  const data = new Uint8Array(12);
  new DataView(data.buffer).setUint32(0, 2, true);
  data.set(u64le(lamports), 4);
  return { programId: SYSTEM_PROGRAM, accounts: [{ address: from, signer: true, writable: true }, { address: to, signer: false, writable: true }], data };
}

/** Creates the recipient's token account if it doesn't exist; does nothing if it does. */
export function createAtaIdempotentInstruction(payer: string, owner: string, mint: string): Instruction {
  return {
    programId: ATA_PROGRAM,
    accounts: [
      { address: payer, signer: true, writable: true },
      { address: associatedTokenAddress(owner, mint), signer: false, writable: true },
      { address: owner, signer: false, writable: false },
      { address: mint, signer: false, writable: false },
      { address: SYSTEM_PROGRAM, signer: false, writable: false },
      { address: TOKEN_PROGRAM, signer: false, writable: false },
    ],
    data: Uint8Array.of(1),
  };
}

export function transferCheckedInstruction(owner: string, mint: string, to: string, amount: bigint, decimals: number): Instruction {
  return {
    programId: TOKEN_PROGRAM,
    accounts: [
      { address: associatedTokenAddress(owner, mint), signer: false, writable: true },
      { address: mint, signer: false, writable: false },
      { address: associatedTokenAddress(to, mint), signer: false, writable: true },
      { address: owner, signer: true, writable: false },
    ],
    data: Uint8Array.from([12, ...u64le(amount), decimals]),
  };
}

export const toBase64 = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};
