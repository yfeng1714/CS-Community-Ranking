import { describe, expect, it } from "vitest";

import {
  ADMIN_RECENT_VOTES_DEFAULT,
  ADMIN_RECENT_VOTES_MAX,
  parseAdminRecentVoteLimit,
} from "@/domain/admin/vote-limit";

describe("admin recent Vote limit", () => {
  it("defaults to ten recent Votes and pages up to a cap", () => {
    expect(parseAdminRecentVoteLimit(undefined)).toBe(ADMIN_RECENT_VOTES_DEFAULT);
    expect(parseAdminRecentVoteLimit("")).toBe(10);
    expect(parseAdminRecentVoteLimit("30")).toBe(30);
    expect(parseAdminRecentVoteLimit("999")).toBe(ADMIN_RECENT_VOTES_MAX);
    expect(parseAdminRecentVoteLimit("3")).toBe(ADMIN_RECENT_VOTES_DEFAULT);
    expect(parseAdminRecentVoteLimit("nope")).toBe(ADMIN_RECENT_VOTES_DEFAULT);
  });
});
