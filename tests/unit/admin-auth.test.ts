import { verify } from "argon2";
import { describe, expect, it } from "vitest";

import {
  adminSessionCookieOptions,
  hashAdminPassword,
  hashAdminSessionToken,
  normalizeAdminUsername,
} from "@/domain/admin/auth";

describe("admin authentication primitives", () => {
  it("normalizes usernames and rejects unsafe shapes", () => {
    expect(normalizeAdminUsername("  Owner.Admin ")).toBe("owner.admin");
    expect(() => normalizeAdminUsername("x".repeat(51))).toThrow(/3–50/);
    expect(() => normalizeAdminUsername("owner admin")).toThrow(/lowercase/);
  });

  it("uses Argon2id for password storage", async () => {
    const passwordHash = await hashAdminPassword("correct horse battery staple");
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    await expect(verify(passwordHash, "correct horse battery staple")).resolves.toBe(true);
    await expect(verify(passwordHash, "wrong password")).resolves.toBe(false);
  });

  it("HMACs opaque session tokens and returns strict cookie options", () => {
    expect(hashAdminSessionToken("token", "a".repeat(32))).not.toEqual(
      hashAdminSessionToken("token", "b".repeat(32)),
    );
    const expiresAt = new Date("2026-01-01T12:00:00.000Z");
    expect(adminSessionCookieOptions(expiresAt)).toEqual({
      expires: expiresAt,
      httpOnly: true,
      path: "/",
      priority: "high",
      sameSite: "strict",
      secure: true,
    });
  });
});
