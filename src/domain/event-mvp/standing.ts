export const EVENT_MVP_STANDINGS = [
  "CHAMPION",
  "RUNNER_UP",
  "THIRD",
  "FOURTH",
  "SEMIFINAL",
  "QUARTERFINAL",
  "ROUND_OF_16",
  "GROUP",
] as const;

export type EventMvpStanding = (typeof EVENT_MVP_STANDINGS)[number];

const STANDING_RANK: Record<EventMvpStanding, number> = {
  CHAMPION: 1,
  RUNNER_UP: 2,
  THIRD: 3,
  FOURTH: 4,
  SEMIFINAL: 4,
  QUARTERFINAL: 5,
  ROUND_OF_16: 6,
  GROUP: 7,
};

const STANDING_LABEL: Record<EventMvpStanding, string> = {
  CHAMPION: "冠军",
  RUNNER_UP: "亚军",
  THIRD: "季军",
  FOURTH: "殿军",
  SEMIFINAL: "四强",
  QUARTERFINAL: "八强",
  ROUND_OF_16: "十六强",
  GROUP: "小组赛",
};

export function isEventMvpStanding(value: string | null | undefined): value is EventMvpStanding {
  return EVENT_MVP_STANDINGS.includes(value as EventMvpStanding);
}

export function eventMvpStandingRank(value: EventMvpStanding | null | undefined): number {
  if (!value) return 99;
  return STANDING_RANK[value];
}

export function eventMvpStandingLabel(value: EventMvpStanding | null | undefined): string {
  if (!value) return "—";
  return STANDING_LABEL[value];
}
