export interface HltvTop20Placement {
  rank: number;
  year: number;
}

export interface HltvTop20Peak {
  rank: number;
  years: number[];
}

export function isHltvTop20Placement(value: HltvTop20Placement): boolean {
  return (
    Number.isInteger(value.rank) &&
    value.rank >= 1 &&
    value.rank <= 20 &&
    Number.isInteger(value.year) &&
    value.year >= 2010 &&
    value.year <= 2099
  );
}

export function peakHltvTop20(
  placements: readonly HltvTop20Placement[],
): HltvTop20Peak | null {
  const valid = placements.filter(isHltvTop20Placement);
  if (valid.length === 0) return null;
  const rank = Math.min(...valid.map((placement) => placement.rank));
  const years = [
    ...new Set(valid.filter((placement) => placement.rank === rank).map((placement) => placement.year)),
  ].sort((left, right) => left - right);
  return { rank, years };
}

export function top20YearPeriod(year: number): { periodEnd: string; periodStart: string } {
  return {
    periodEnd: `${year}-12-31`,
    periodStart: `${year}-01-01`,
  };
}
