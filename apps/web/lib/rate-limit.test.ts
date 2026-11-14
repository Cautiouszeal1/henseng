import { describe, expect, it } from "vitest";
import { createMemoryStore, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit then blocks within the window", async () => {
    const store = createMemoryStore();
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await rateLimit("k", 3, 60_000, store)).allowed);
    expect(results).toEqual([true, true, true, false]);
  });

  it("tracks keys independently", async () => {
    const store = createMemoryStore();
    await rateLimit("a", 1, 60_000, store);
    expect((await rateLimit("b", 1, 60_000, store)).allowed).toBe(true);
    expect((await rateLimit("a", 1, 60_000, store)).allowed).toBe(false);
  });
});
