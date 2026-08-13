import { DomainError } from "../../error.ts";
import { normalizedRankingSnapshotSchema, type NormalizedRankingSnapshot } from "../types.ts";

export const VALVE_VRS_PARSER_VERSION = "valve-vrs-markdown-v2";
const OFFICIAL_REPOSITORY = "ValveSoftware/counter-strike_regional_standings";

export function assertOfficialValveVrsUrl(value: string): URL {
  const url = new URL(value);
  const officialGithub =
    url.hostname === "github.com" && url.pathname.startsWith(`/${OFFICIAL_REPOSITORY}/`);
  const officialRaw =
    url.hostname === "raw.githubusercontent.com" &&
    url.pathname.startsWith(`/${OFFICIAL_REPOSITORY}/`);
  if (url.protocol !== "https:" || (!officialGithub && !officialRaw)) {
    throw new DomainError(
      "VRS_SOURCE_NOT_OFFICIAL",
      "VRS source must be an HTTPS file in ValveSoftware/counter-strike_regional_standings",
    );
  }
  return url;
}

export function parseValveVrsMarkdown(body: string, sourceUrl: string): NormalizedRankingSnapshot {
  assertOfficialValveVrsUrl(sourceUrl);
  const dateMatch = /^### Standings as of (\d{4})_(\d{2})_(\d{2})(?:\s*<br\s*\/?>)?\s*$/im.exec(
    body,
  );
  if (!dateMatch) {
    throw new DomainError("VRS_PUBLISHED_DATE_MISSING", "VRS standings date was not found");
  }
  const publishedAt = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T00:00:00.000Z`);
  if (Number.isNaN(publishedAt.getTime())) {
    throw new DomainError("VRS_PUBLISHED_DATE_INVALID", "VRS standings date is invalid");
  }

  const teams = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\|?\s*\d+\s*\|/.test(line))
    .map((line) => {
      const columns = line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((column) => column.trim());
      const rank = Number(columns[0]);
      const points = Number(columns[1]);
      const name = columns[2] ?? "";
      const roster = (columns[3] ?? "")
        .split(",")
        .map((player) => player.trim())
        .filter(Boolean);
      return { externalId: null, externalSlug: null, name, points, rank, roster };
    });

  const result = normalizedRankingSnapshotSchema.safeParse({
    publishedAt: publishedAt.toISOString(),
    sourceUrl,
    teams,
    version: 1,
  });
  if (!result.success) {
    throw new DomainError(
      "VRS_PARSE_FAILED",
      "Valve VRS document did not match the expected format",
      {
        issues: result.error.issues.map((issue) => issue.message),
      },
    );
  }
  if (new Set(result.data.teams.map((team) => team.rank)).size !== result.data.teams.length) {
    throw new DomainError("VRS_RANK_DUPLICATE", "Valve VRS document contains duplicate ranks");
  }
  return result.data;
}
