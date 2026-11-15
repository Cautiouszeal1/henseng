import { formatUnits, getAddress, hexToBytes, isAddress, isHex, type Hex } from "viem";

/**
 * The wallet side of the in-app dApp browser. Every request a website makes to `window.ethereum`
 * lands here. Rules:
 *  - The site's identity is the origin of the page the browser is showing (passed in by the
 *    browser screen from the WebView's own URL), never anything the page claims about itself.
 *  - A site sees the address only after the user taps Connect for that origin.
 *  - Every signature and transaction is shown to the user first. Transactions and token-permit
 *    signatures also need the wallet password, like Send.
 *  - `eth_sign` (blind hash signing) is refused outright.
 *  - Only an allow-list of read-only RPC methods is forwarded to the network.
 * No React Native imports here, so it can be tested against a real chain in Node.
 */

export class ProviderError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}
export const rejected = () => new ProviderError(4001, "The user rejected the request.");
const unauthorized = () => new ProviderError(4100, "Connect the site to HENSENG first.");
const unsupported = (m: string) => new ProviderError(4200, `HENSENG doesn't support ${m}.`);

export interface TxSummary {
  to: `0x${string}`;
  value: bigint;
  data?: Hex;
  gas?: bigint;
  /** Recognised ERC-20 approve(spender, amount) */
  approve?: { spender: `0x${string}`; amount: bigint; unlimited: boolean };
}

export type Approval =
  | { kind: "connect"; origin: string; chainId: number }
  | { kind: "message"; origin: string; text: string; raw: Hex | string }
  | { kind: "typed"; origin: string; chainId: number; primaryType: string; domainName?: string; verifyingContract?: string; data: unknown; permit: boolean }
  | { kind: "transaction"; origin: string; chainId: number; tx: TxSummary }
  | { kind: "switch"; origin: string; from: number; to: number };

export interface BridgeDeps {
  address: `0x${string}`;
  /** Chain ids the wallet can sign on */
  supportedChains: number[];
  getChainId(): number;
  setChainId(id: number): void;
  isConnected(origin: string): Promise<boolean>;
  setConnected(origin: string, connected: boolean): Promise<void>;
  /** Shows the approval UI. Resolves true if the user approved (including the password where asked). */
  approve(a: Approval): Promise<boolean>;
  signMessage(message: string | { raw: Hex }): Promise<Hex>;
  signTypedData(typed: { domain: any; types: any; primaryType: string; message: any }): Promise<Hex>;
  sendTransaction(tx: { chainId: number; to: `0x${string}`; value?: bigint; data?: Hex; gas?: bigint }): Promise<Hex>;
  /** Read-only JSON-RPC against the given chain */
  rpc(chainId: number, method: string, params: unknown[]): Promise<unknown>;
  emit(event: "accountsChanged" | "chainChanged" | "connect" | "disconnect", data: unknown): void;
}

const READ_METHODS = new Set([
  "eth_blockNumber", "eth_call", "eth_estimateGas", "eth_feeHistory", "eth_gasPrice", "eth_getBalance",
  "eth_getBlockByHash", "eth_getBlockByNumber", "eth_getCode", "eth_getLogs", "eth_getStorageAt",
  "eth_getTransactionByHash", "eth_getTransactionCount", "eth_getTransactionReceipt", "eth_maxPriorityFeePerGas",
]);

const hexChain = (id: number) => `0x${id.toString(16)}`;
const MAX_UINT = 2n ** 256n - 1n;

function parseChainId(v: unknown): number {
  if (typeof v === "string" && /^0x[0-9a-f]+$/i.test(v)) return parseInt(v, 16);
  if (typeof v === "number" && Number.isInteger(v)) return v;
  throw new ProviderError(-32602, "Invalid chain id.");
}

/** Decodes a personal_sign payload for display: UTF-8 text when it is text, otherwise the hex. */
export function messageText(raw: string): string {
  if (!isHex(raw)) return raw;
  try {
    const s = new TextDecoder("utf-8", { fatal: true }).decode(hexToBytes(raw));
    return s.length > 0 && /^[\P{C}\n\r\t]*$/u.test(s) ? s : raw;
  } catch {
    return raw;
  }
}

export function summarizeTx(p: any): TxSummary {
  if (!p || typeof p !== "object" || !isAddress(p.to ?? "", { strict: false })) throw new ProviderError(-32602, "HENSENG can only send transactions to an address (contract deployment isn't supported).");
  const value = p.value ? BigInt(p.value) : 0n;
  const data = p.data ?? p.input;
  if (data !== undefined && !isHex(data)) throw new ProviderError(-32602, "Invalid transaction data.");
  const tx: TxSummary = { to: getAddress(String(p.to).toLowerCase()), value, data: data && data !== "0x" ? data : undefined, gas: p.gas ? BigInt(p.gas) : undefined };
  if (tx.data && tx.data.slice(0, 10).toLowerCase() === "0x095ea7b3" && tx.data.length === 138) {
    const spender = getAddress(`0x${tx.data.slice(34, 74)}`);
    const amount = BigInt(`0x${tx.data.slice(74)}`);
    tx.approve = { spender, amount, unlimited: amount >= MAX_UINT / 2n };
  }
  return tx;
}

const PERMIT_TYPES = /permit/i;

export async function handleRequest(origin: string, method: string, params: unknown, d: BridgeDeps): Promise<unknown> {
  const args = Array.isArray(params) ? params : params === undefined ? [] : [params];
  const connected = () => d.isConnected(origin);
  const needConnected = async () => {
    if (!(await connected())) throw unauthorized();
  };

  switch (method) {
    case "eth_chainId":
      return hexChain(d.getChainId());
    case "net_version":
      return String(d.getChainId());
    case "eth_accounts":
      return (await connected()) ? [d.address] : [];
    case "eth_requestAccounts":
    case "wallet_requestPermissions": {
      if (!(await connected())) {
        if (!(await d.approve({ kind: "connect", origin, chainId: d.getChainId() }))) throw rejected();
        await d.setConnected(origin, true);
        d.emit("accountsChanged", [d.address]);
      }
      return method === "eth_requestAccounts" ? [d.address] : [{ parentCapability: "eth_accounts" }];
    }
    case "wallet_getPermissions":
      return (await connected()) ? [{ parentCapability: "eth_accounts" }] : [];
    case "wallet_revokePermissions":
      await d.setConnected(origin, false);
      d.emit("accountsChanged", []);
      return null;
    case "wallet_switchEthereumChain":
    case "wallet_addEthereumChain": {
      const to = parseChainId((args[0] as any)?.chainId);
      if (!d.supportedChains.includes(to)) throw new ProviderError(4902, "HENSENG doesn't support this network yet.");
      if (to === d.getChainId()) return null;
      if (!(await d.approve({ kind: "switch", origin, from: d.getChainId(), to }))) throw rejected();
      d.setChainId(to);
      d.emit("chainChanged", hexChain(to));
      return null;
    }
    case "personal_sign": {
      await needConnected();
      // personal_sign(message, address); some sites send them the other way round.
      const [a, b] = args as string[];
      const raw = isAddress(a ?? "", { strict: false }) && !isAddress(b ?? "", { strict: false }) ? b : a;
      const who = raw === a ? b : a;
      if (typeof raw !== "string") throw new ProviderError(-32602, "Missing message.");
      if (who && who.toLowerCase() !== d.address.toLowerCase()) throw unauthorized();
      const text = messageText(raw);
      if (!(await d.approve({ kind: "message", origin, text, raw }))) throw rejected();
      return d.signMessage(isHex(raw) ? { raw } : raw);
    }
    case "eth_signTypedData_v4":
    case "eth_signTypedData_v3":
    case "eth_signTypedData": {
      await needConnected();
      const [who, json] = args as [string, unknown];
      if (typeof who !== "string" || who.toLowerCase() !== d.address.toLowerCase()) throw unauthorized();
      const typed = typeof json === "string" ? JSON.parse(json) : json;
      if (!typed?.types || !typed?.primaryType || !typed?.domain) throw new ProviderError(-32602, "Invalid typed data.");
      const chain = typed.domain.chainId !== undefined ? Number(typed.domain.chainId) : d.getChainId();
      if (chain !== d.getChainId()) throw new ProviderError(-32602, "The signature is for a different network than the one selected.");
      const { EIP712Domain: _drop, ...types } = typed.types;
      const permit = PERMIT_TYPES.test(typed.primaryType) || Object.keys(types).some((t) => PERMIT_TYPES.test(t));
      const ok = await d.approve({ kind: "typed", origin, chainId: chain, primaryType: typed.primaryType, domainName: typed.domain.name, verifyingContract: typed.domain.verifyingContract, data: typed.message, permit });
      if (!ok) throw rejected();
      return d.signTypedData({ domain: typed.domain, types, primaryType: typed.primaryType, message: typed.message });
    }
    case "eth_sendTransaction": {
      await needConnected();
      const p = args[0] as any;
      if (p?.from && String(p.from).toLowerCase() !== d.address.toLowerCase()) throw unauthorized();
      if (p?.chainId !== undefined && parseChainId(p.chainId) !== d.getChainId()) throw new ProviderError(-32602, "The transaction is for a different network than the one selected.");
      const tx = summarizeTx(p);
      const chainId = d.getChainId();
      if (!(await d.approve({ kind: "transaction", origin, chainId, tx }))) throw rejected();
      return d.sendTransaction({ chainId, to: tx.to, value: tx.value, data: tx.data, gas: tx.gas });
    }
    case "eth_sign":
      throw new ProviderError(4200, "HENSENG never signs raw hashes (eth_sign), because they can authorise anything.");
    case "wallet_watchAsset":
      return false;
    default:
      if (READ_METHODS.has(method)) return d.rpc(d.getChainId(), method, args);
      throw unsupported(method);
  }
}

export const formatEth = (v: bigint) => formatUnits(v, 18);
