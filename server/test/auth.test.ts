import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "../src/modules/auth/auth.js";
import { hashPassword, isValidHash, verifyPassword } from "../src/modules/auth/password.js";

describe("password hashing", () => {
  it("verifies the right password only", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(isValidHash(hash)).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("rejects malformed hashes", async () => {
    expect(isValidHash("plain")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$2")).toBe(false);
  });
});

describe("session tokens", () => {
  it("accepts a fresh token and rejects tampering", () => {
    const { token } = createSessionToken();
    expect(verifySessionToken(token)).toBe(true);
    const [data, sig] = token.split(".");
    expect(verifySessionToken(`${data}.${sig!.slice(0, -1)}A`)).toBe(false);
    const forged = Buffer.from(JSON.stringify({ exp: Date.now() + 1e9, v: "x" })).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`)).toBe(false);
    expect(verifySessionToken(undefined)).toBe(false);
  });
});
