import { describe, expect, it } from "vitest";

import {
  createVisitorToken,
  hashVisitorToken,
  isValidVisitorToken,
  visitorCookieOptions,
} from "@/domain/visitors/service";

describe("visitor identity primitives", () => {
  it("generates a 32-byte base64url token and hashes it with HMAC-SHA-256", () => {
    const token = createVisitorToken();
    const hash = hashVisitorToken(token, "a-secure-test-pepper-that-is-long-enough");

    expect(isValidVisitorToken(token)).toBe(true);
    expect(hash).toHaveLength(32);
    expect(hash.toString("utf8")).not.toContain(token);
    expect(hashVisitorToken(token, "a-different-secure-test-pepper-value")).not.toEqual(hash);
  });

  it("rejects malformed caller-supplied tokens", () => {
    expect(isValidVisitorToken(undefined)).toBe(false);
    expect(isValidVisitorToken("short")).toBe(false);
    expect(isValidVisitorToken("a".repeat(42) + "=")).toBe(false);
  });

  it("uses host-cookie-compatible attributes without exposing a Domain", () => {
    expect(visitorCookieOptions(365)).toEqual({
      httpOnly: true,
      maxAge: 31_536_000,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });
});
