import { gcm } from "@noble/ciphers/aes.js";
import { bytesToUtf8 } from "@noble/ciphers/utils.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

/**
 * Encrypted vault for the seed phrase.
 *
 *   key        = scrypt(password, salt, N=2^15, r=8, p=1, 32 bytes)
 *   ciphertext = AES-256-GCM(key, nonce, payload)
 *
 * The vault is only ever stored on the user's device (Keychain/Keystore via
 * expo-secure-store on mobile, browser storage on web and in the extension).
 * It is never sent to HENSENG's servers. A wrong password fails the GCM
 * authentication check, so there is no way to "partially" decrypt.
 *
 * Pure-JS primitives (@noble) are used so the same code runs identically on
 * Hermes (iOS/Android), browsers and the extension service worker.
 */

export const VAULT_VERSION = 1;

export interface KdfParams {
  N: number;
  r: number;
  p: number;
}

/** Default work factor. Raise in a future vault version; old vaults keep their params. */
export const DEFAULT_KDF: KdfParams = { N: 2 ** 15, r: 8, p: 1 };

export interface VaultPayload {
  mnemonic: string;
  /** Number of EVM accounts the user has created from this phrase */
  accountCount: number;
  createdAt: string;
}

export interface EncryptedVault {
  version: typeof VAULT_VERSION;
  kdf: "scrypt";
  kdfParams: KdfParams;
  salt: string; // hex
  nonce: string; // hex
  ciphertext: string; // hex (includes the GCM tag)
}

export class WrongPasswordError extends Error {
  constructor() {
    super("That password is not correct.");
    this.name = "WrongPasswordError";
  }
}

export const MIN_PASSWORD_LENGTH = 8;

export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) problems.push(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) problems.push("Mix letters and numbers.");
  return problems;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array, params: KdfParams): Promise<Uint8Array> {
  return scryptAsync(utf8ToBytes(password.normalize("NFKC")), salt, { ...params, dkLen: 32 });
}

export async function encryptVault(
  payload: VaultPayload,
  password: string,
  params: KdfParams = DEFAULT_KDF,
): Promise<EncryptedVault> {
  const salt = randomBytes(32);
  const nonce = randomBytes(12);
  const key = await deriveKey(password, salt, params);
  const ciphertext = gcm(key, nonce).encrypt(utf8ToBytes(JSON.stringify(payload)));
  key.fill(0);
  return {
    version: VAULT_VERSION,
    kdf: "scrypt",
    kdfParams: params,
    salt: bytesToHex(salt),
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(ciphertext),
  };
}

export async function decryptVault(vault: EncryptedVault, password: string): Promise<VaultPayload> {
  if (vault.version !== VAULT_VERSION || vault.kdf !== "scrypt") {
    throw new Error("This wallet vault was created by a newer version of HENSENG. Update the app.");
  }
  const key = await deriveKey(password, hexToBytes(vault.salt), vault.kdfParams);
  let plain: Uint8Array;
  try {
    plain = gcm(key, hexToBytes(vault.nonce)).decrypt(hexToBytes(vault.ciphertext));
  } catch {
    throw new WrongPasswordError();
  } finally {
    key.fill(0);
  }
  return JSON.parse(bytesToUtf8(plain)) as VaultPayload;
}

export function isEncryptedVault(value: unknown): value is EncryptedVault {
  const v = value as EncryptedVault;
  return (
    !!v &&
    v.version === VAULT_VERSION &&
    v.kdf === "scrypt" &&
    typeof v.salt === "string" &&
    typeof v.nonce === "string" &&
    typeof v.ciphertext === "string"
  );
}
