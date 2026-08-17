export function formatRating(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

export const RECENT_RATING_LABEL = "近三月 Rating 3.0";
export const CAREER_RATING_LABEL = "生涯 Rating";

export function headlineRating(input: {
  careerRating: number | null;
  recentRating: number | null;
}): { label: typeof CAREER_RATING_LABEL | typeof RECENT_RATING_LABEL; value: number | null } {
  if (input.recentRating !== null) {
    return { label: RECENT_RATING_LABEL, value: input.recentRating };
  }
  if (input.careerRating !== null) {
    return { label: CAREER_RATING_LABEL, value: input.careerRating };
  }
  return { label: RECENT_RATING_LABEL, value: null };
}

export function formatInteger(value: number | null): string {
  return value === null ? "—" : String(Math.round(value));
}

export function formatFirepower(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}/100`;
}

export function formatAdr(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

export function formatPlayerHonors(
  majorsWon: number | null,
  mvpCount: number | null,
): string | null {
  if (majorsWon === null && mvpCount === null) {
    return null;
  }
  const parts: string[] = [];
  if (majorsWon !== null) parts.push(`🏆 ${Math.round(majorsWon)} Major`);
  if (mvpCount !== null) parts.push(`🏅 ${Math.round(mvpCount)} MVP`);
  return parts.join(" · ");
}

export function formatTop20Peak(peak: { rank: number; years: number[] } | null): string {
  if (!peak || peak.years.length === 0) return "—";
  return `#${peak.rank} · ${peak.years.join(", ")}`;
}
