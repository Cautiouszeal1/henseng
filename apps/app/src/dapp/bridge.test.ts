import { describe, expect, it } from "vitest";
import { createPublicClient, createWalletClient, http, recoverTypedDataAddress, stringToHex, verifyMessage, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { buildProviderScript } from "./provider-script";
import { handleRequest, messageText, summarizeTx, type Approval, type BridgeDeps } from "./bridge";

// Hardhat's first default account: public test key, funded only on local test chains.
const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const RPC = process.env.TEST_SEPOLIA_RPC ?? "http://127.0.0.1:8545";
const SITE = "https://app.example";

function harness(opts: { approve?: boolean | ((a: Approval) => boolean) } = {}) {
  const connected = new Set<string>();
  const asked: Approval[] = [];
  const events: [string, unknown][] = [];
  let chain = 11155111;
  const d: BridgeDeps = {
    address: account.address,
    supportedChains: [1, 8453, 42161, 11155111, 84532],
    getChainId: () => chain,
    setChainId: (id) => (chain = id),
    isConnected: async (o) => connected.has(o),
    setConnected: async (o, c) => void (c ? connected.add(o) : connected.delete(o)),
    approve: async (a) => {
      asked.push(a);
      const r = opts.approve ?? true;
      return typeof r === "function" ? r(a) : r;
    },
    signMessage: (m) => account.signMessage({ message: m }),
    signTypedData: (t) => account.signTypedData(t),
    sendTransaction: (tx) => createWalletClient({ account, chain: sepolia, transport: http(RPC) }).sendTransaction({ to: tx.to, value: tx.value, data: tx.data }),
    rpc: (_id, method, params) => createPublicClient({ chain: sepolia, transport: http(RPC) }).request({ method: method as any, params: params as any }),
    emit: (e, data) => void events.push([e, data]),
  };
  return { d, asked, events, connected, req: (method: string, params?: unknown, origin = SITE) => handleRequest(origin, method, params, d) };
}

describe("dApp bridge: connection", () => {
  it("hides the address until the user connects, per site", async () => {
    const h = harness();
    expect(await h.req("eth_accounts")).toEqual([]);
    expect(await h.req("eth_requestAccounts")).toEqual([account.address]);
    expect(h.asked[0]).toMatchObject({ kind: "connect", origin: SITE });
    expect(await h.req("eth_accounts")).toEqual([account.address]);
    expect(await h.req("eth_accounts", [], "https://other.example")).toEqual([]);
    expect(h.events).toContainEqual(["accountsChanged", [account.address]]);
  });
  it("rejection returns EIP-1193 code 4001", async () => {
    const h = harness({ approve: false });
    await expect(h.req("eth_requestAccounts")).rejects.toMatchObject({ code: 4001 });
  });
  it("signing before connecting is refused with 4100", async () => {
    const h = harness();
    await expect(h.req("personal_sign", [stringToHex("hi"), account.address])).rejects.toMatchObject({ code: 4100 });
    expect(h.asked).toHaveLength(0);
  });
  it("disconnect revokes access", async () => {
    const h = harness();
    await h.req("eth_requestAccounts");
    await h.req("wallet_revokePermissions", [{ eth_accounts: {} }]);
    expect(await h.req("eth_accounts")).toEqual([]);
  });
});

describe("dApp bridge: networks", () => {
  it("switches between supported networks after approval and emits chainChanged", async () => {
    const h = harness();
    expect(await h.req("eth_chainId")).toBe("0xaa36a7");
    await h.req("wallet_switchEthereumChain", [{ chainId: "0x2105" }]);
    expect(await h.req("eth_chainId")).toBe("0x2105");
    expect(h.events).toContainEqual(["chainChanged", "0x2105"]);
  });
  it("unsupported networks get 4902", async () => {
    await expect(harness().req("wallet_switchEthereumChain", [{ chainId: "0x38" }])).rejects.toMatchObject({ code: 4902 });
  });
});

describe("dApp bridge: signing", () => {
  it("personal_sign shows the decoded text and produces a valid signature (either parameter order)", async () => {
    const h = harness();
    await h.req("eth_requestAccounts");
    const msg = "Sign in to app.example\nNonce: 42";
    const sig = (await h.req("personal_sign", [stringToHex(msg), account.address])) as Hex;
    expect(h.asked.at(-1)).toMatchObject({ kind: "message", text: msg });
    expect(await verifyMessage({ address: account.address, message: msg, signature: sig })).toBe(true);
    const sig2 = (await h.req("personal_sign", [account.address, stringToHex(msg)])) as Hex;
    expect(sig2).toBe(sig);
  });
  it("refuses to sign for another address", async () => {
    const h = harness();
    await h.req("eth_requestAccounts");
    await expect(h.req("personal_sign", [stringToHex("x"), "0x000000000000000000000000000000000000dEaD"])).rejects.toMatchObject({ code: 4100 });
  });
  it("never does eth_sign", async () => {
    const h = harness();
    await h.req("eth_requestAccounts");
    await expect(h.req("eth_sign", [account.address, "0x" + "11".repeat(32)])).rejects.toMatchObject({ code: 4200 });
  });
  it("signs EIP-712 and flags permits", async () => {
    const h = harness();
    await h.req("eth_requestAccounts");
    const typed = {
      domain: { name: "USD Coin", version: "2", chainId: 11155111, verifyingContract: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" },
      types: { EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }], Permit: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }, { name: "value", type: "uint256" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }] },
      primaryType: "Permit",
      message: { owner: account.address, spender: "0x000000000000000000000000000000000000bEEF", value: "1000000", nonce: "0", deadline: "9999999999" },
    };
    const sig = (await h.req("eth_signTypedData_v4", [account.address, JSON.stringify(typed)])) as Hex;
    expect(h.asked.at(-1)).toMatchObject({ kind: "typed", permit: true, primaryType: "Permit" });
    const { EIP712Domain: _d, ...types } = typed.types;
    expect(await recoverTypedDataAddress({ domain: typed.domain as any, types, primaryType: "Permit", message: typed.message as any, signature: sig })).toBe(account.address);
  });
  it("refuses typed data for a different network", async () => {
    const h = harness();
    await h.req("eth_requestAccounts");
    await expect(h.req("eth_signTypedData_v4", [account.address, { domain: { chainId: 1 }, types: { Mail: [] }, primaryType: "Mail", message: {} }])).rejects.toThrow(/different network/);
  });
});

describe("dApp bridge: transactions", () => {
  it("decodes ERC-20 approvals and spots unlimited ones", () => {
    const t = summarizeTx({ to: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", data: "0x095ea7b3" + "000000000000000000000000000000000000000000000000000000000000beef".padStart(64, "0") + "f".repeat(64) });
    expect(t.approve).toMatchObject({ unlimited: true });
  });
  it("refuses contract deployment and other senders", async () => {
    const h = harness();
    await h.req("eth_requestAccounts");
    await expect(h.req("eth_sendTransaction", [{ from: account.address, data: "0x6000" }])).rejects.toThrow(/deployment/);
    await expect(h.req("eth_sendTransaction", [{ from: "0x000000000000000000000000000000000000dEaD", to: account.address }])).rejects.toMatchObject({ code: 4100 });
  });
  it("unknown methods get 4200 and aren't forwarded", async () => {
    await expect(harness().req("eth_sendRawTransaction", ["0x00"])).rejects.toMatchObject({ code: 4200 });
    await expect(harness().req("debug_traceTransaction", ["0x00"])).rejects.toMatchObject({ code: 4200 });
  });
  it("messageText keeps binary as hex", () => {
    expect(messageText("0xdeadbeef")).toBe("0xdeadbeef");
    expect(messageText(stringToHex("hello"))).toBe("hello");
  });
});

const chainUp = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId"}' }).then((r) => r.ok).catch(() => false);
describe.skipIf(!chainUp)("dApp bridge: against a local chain", () => {
  it("reads go through, and an approved transaction is mined", async () => {
    const h = harness();
    await h.req("eth_requestAccounts");
    const to = "0x00000000000000000000000000000000000B0B02";
    const before = BigInt((await h.req("eth_getBalance", [to, "latest"])) as string);
    const hash = (await h.req("eth_sendTransaction", [{ from: account.address, to, value: "0x2386f26fc10000" }])) as Hex;
    expect(h.asked.at(-1)).toMatchObject({ kind: "transaction", tx: { to, value: 10n ** 16n } });
    const receipt = await createPublicClient({ chain: sepolia, transport: http(RPC) }).waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");
    expect(BigInt((await h.req("eth_getBalance", [to, "latest"])) as string) - before).toBe(10n ** 16n);
  });
  it("a rejected transaction is never sent", async () => {
    const h = harness({ approve: (a) => a.kind !== "transaction" });
    await h.req("eth_requestAccounts");
    const n = await h.req("eth_getTransactionCount", [account.address, "latest"]);
    await expect(h.req("eth_sendTransaction", [{ to: account.address, value: "0x1" }])).rejects.toMatchObject({ code: 4001 });
    expect(await h.req("eth_getTransactionCount", [account.address, "latest"])).toBe(n);
  });
});

describe("provider script", () => {
  it("is valid JavaScript and embeds no secrets on window", () => {
    const s = buildProviderScript({ chainId: 1, secret: "abc123", uuid: "u" });
    expect(() => new Function(s)).not.toThrow();
    expect(s).not.toMatch(/window\.\w*secret/i);
  });
});

describe("dApp bridge: address formats", () => {
  it("accepts addresses whatever their capitalisation", () => {
    expect(summarizeTx({ to: "0x00000000000000000000000000000000000B0B03", value: "0x1" }).to).toBe("0x00000000000000000000000000000000000b0B03");
    expect(summarizeTx({ to: "0xc992c8f0cf159f40c59086ca7ef2d29c446a6f4c" }).to).toBe("0xC992c8F0Cf159f40C59086Ca7ef2D29C446A6F4C");
  });
});
