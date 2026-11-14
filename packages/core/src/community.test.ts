import { describe, expect, it } from "vitest";
import { atLeast, canChangeRole, canDeleteMessage, canModerate, canPost, slugify, usernameProblem } from "./community";

describe("community permissions", () => {
  it("only lets members at or above the channel role post", () => {
    expect(canPost("MEMBER", "MEMBER")).toBe(true);
    expect(canPost(null, "MEMBER")).toBe(false);
    expect(canPost("MODERATOR", "ADMIN")).toBe(false);
    expect(canPost("OWNER", "ADMIN")).toBe(true);
  });

  it("lets authors delete their own messages and higher-ranked moderators delete others'", () => {
    expect(canDeleteMessage({ id: "a", role: "MEMBER" }, { id: "a", role: "MEMBER" })).toBe(true);
    expect(canDeleteMessage({ id: "m", role: "MODERATOR" }, { id: "a", role: "MEMBER" })).toBe(true);
    expect(canDeleteMessage({ id: "m", role: "MODERATOR" }, { id: "x", role: "ADMIN" })).toBe(false);
    expect(canDeleteMessage({ id: "b", role: "MEMBER" }, { id: "a", role: "MEMBER" })).toBe(false);
  });

  it("never lets anyone moderate the owner or someone of equal rank", () => {
    expect(canModerate("ADMIN", "OWNER")).toBe(false);
    expect(canModerate("MODERATOR", "MODERATOR")).toBe(false);
    expect(canModerate("ADMIN", "MODERATOR")).toBe(true);
    expect(canModerate("MEMBER", "MEMBER")).toBe(false);
  });

  it("limits role changes to roles below the actor's own", () => {
    expect(canChangeRole("OWNER", "MEMBER", "ADMIN")).toBe(true);
    expect(canChangeRole("ADMIN", "MEMBER", "ADMIN")).toBe(false);
    expect(canChangeRole("ADMIN", "MEMBER", "MODERATOR")).toBe(true);
    expect(canChangeRole("OWNER", "MEMBER", "OWNER")).toBe(false);
    expect(canChangeRole("MODERATOR", "MEMBER", "MEMBER")).toBe(false);
    expect(atLeast("ADMIN", "MODERATOR")).toBe(true);
  });
});

describe("names", () => {
  it("slugifies community names", () => {
    expect(slugify("Web3 Builders — Lagos!")).toBe("web3-builders-lagos");
    expect(slugify("Ça va DAO")).toBe("ca-va-dao");
  });

  it("validates and reserves usernames", () => {
    expect(usernameProblem("evans")).toBeNull();
    expect(usernameProblem("Ev")).not.toBeNull();
    expect(usernameProblem("admin")).toBe("That username is reserved.");
    expect(usernameProblem("henseng_official")).toBe("That username is reserved.");
  });
});
