import { describe, expect, it } from "vitest";
import { collectReactions, kindOf, lastPeerReadAt, nsToDate, parseTarget, previewOf, typeIdOf, type ChatMessage } from "./model";

const base = (over: Partial<ChatMessage>): ChatMessage => ({
  id: "m",
  chatId: "c",
  senderInboxId: "peer",
  fromMe: false,
  sentAt: new Date(1000),
  kind: "text",
  status: "sent",
  ...over,
});

describe("content types", () => {
  it("reads type ids from native strings and browser objects", () => {
    expect(typeIdOf("xmtp.org/text:1.0")).toBe("text");
    expect(typeIdOf("xmtp.org/reaction:2.0")).toBe("reaction");
    expect(typeIdOf({ typeId: "reply" })).toBe("reply");
    expect(typeIdOf(undefined)).toBe("");
    expect(kindOf("readReceipt")).toBe("readReceipt");
    expect(kindOf("group_updated")).toBe("groupUpdate");
    expect(kindOf("transactionReference")).toBe("other");
  });

  it("builds list previews and ignores receipts", () => {
    expect(previewOf({ kind: "text", text: "gm" })).toBe("gm");
    expect(previewOf({ kind: "reaction", reaction: { emoji: "🔥", action: "added", referenceId: "x" } })).toBe("Reacted 🔥");
    expect(previewOf({ kind: "readReceipt" })).toBeNull();
  });

  it("converts nanoseconds to dates", () => {
    expect(nsToDate(1_700_000_000_000_000_000n).toISOString()).toBe("2023-11-14T22:13:20.000Z");
  });
});

describe("reactions and receipts", () => {
  it("adds and removes reactions per sender", () => {
    const msgs = [
      base({ id: "r1", kind: "reaction", senderInboxId: "a", sentAt: new Date(1), reaction: { emoji: "👍", action: "added", referenceId: "t" } }),
      base({ id: "r2", kind: "reaction", senderInboxId: "b", sentAt: new Date(2), reaction: { emoji: "👍", action: "added", referenceId: "t" } }),
      base({ id: "r3", kind: "reaction", senderInboxId: "a", sentAt: new Date(3), reaction: { emoji: "👍", action: "removed", referenceId: "t" } }),
      base({ id: "r4", kind: "reaction", senderInboxId: "a", sentAt: new Date(4), reaction: { emoji: "🔥", action: "added", referenceId: "t" } }),
    ];
    const r = collectReactions(msgs).get("t")!;
    expect([...r.get("👍")!]).toEqual(["b"]);
    expect([...r.get("🔥")!]).toEqual(["a"]);
  });

  it("finds the peer's latest read receipt and ignores my own", () => {
    const msgs = [
      base({ kind: "readReceipt", sentAt: new Date(5) }),
      base({ kind: "readReceipt", sentAt: new Date(9), fromMe: true }),
      base({ kind: "readReceipt", sentAt: new Date(7) }),
    ];
    expect(lastPeerReadAt(msgs)?.getTime()).toBe(7);
    expect(lastPeerReadAt([])).toBeNull();
  });
});

describe("new chat targets", () => {
  it("accepts addresses, ENS names and usernames", () => {
    expect(parseTarget(" 0xF39Fd6e51aad88F6F4ce6aB8827279cffFb92266 ")).toEqual({ type: "address", value: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266" });
    expect(parseTarget("vitalik.eth")).toEqual({ type: "ens", value: "vitalik.eth" });
    expect(parseTarget("@Amara_7")).toEqual({ type: "username", value: "amara_7" });
  });

  it("explains bad input", () => {
    expect(parseTarget("0x1234").type).toBe("invalid");
    expect(parseTarget("").type).toBe("invalid");
    expect(parseTarget("hello world").type).toBe("invalid");
  });
});
