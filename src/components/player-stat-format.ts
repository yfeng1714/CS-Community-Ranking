export function formatRating(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
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
