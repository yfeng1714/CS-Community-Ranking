export const ADMIN_RECENT_VOTES_DEFAULT = 10;
export const ADMIN_RECENT_VOTES_STEP = 20;
export const ADMIN_RECENT_VOTES_MAX = 200;

export function parseAdminRecentVoteLimit(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return ADMIN_RECENT_VOTES_DEFAULT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < ADMIN_RECENT_VOTES_DEFAULT) {
    return ADMIN_RECENT_VOTES_DEFAULT;
  }
  return Math.min(parsed, ADMIN_RECENT_VOTES_MAX);
}
