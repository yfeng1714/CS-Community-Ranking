import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertHltvTeamLogoUrl,
  listHltvTeamLogoTargets,
  logoAssetPath,
  pickHltvTeamLogoSource,
  validateHltvTeamLogoBundle,
} from "@/domain/assets/hltv-team-logos";
import { loadReviewManualManifest } from "@/domain/pool/review-manual-manifest";

const reviewManualFile = path.resolve("data/review-manual/2026-08-17.json");

describe("HLTV team-logo targets", () => {
  it("lists the four Review Manual teams", async () => {
    const reviewManual = await loadReviewManualManifest(reviewManualFile);
    const targets = listHltvTeamLogoTargets(reviewManual);
    expect(targets.map((target) => target.slug)).toEqual([
      "bcgame",
      "100-thieves",
      "tyloo",
      "lynn-vision",
    ]);
    expect(logoAssetPath("bcgame", "webp")).toBe("/images/teams/bcgame.webp");
  });

  it("prefers a night-only HLTV teamlogo at the larger observed width", () => {
    const picked = pickHltvTeamLogoSource([
      {
        className: "teamlogo day-only",
        src: "https://img-cdn.hltv.org/teamlogo/day.png?ixlib=java-2.1.0&w=100&s=aaa",
      },
      {
        className: "teamlogo night-only",
        src: "https://img-cdn.hltv.org/teamlogo/night.png?ixlib=java-2.1.0&w=50&s=bbb",
      },
      {
        className: "team-background-logo night-only",
        src: "https://img-cdn.hltv.org/teamlogo/night.png?ixlib=java-2.1.0&w=100&s=ccc",
      },
    ]);
    expect(picked.variant).toBe("night");
    expect(picked.sourceUrl.searchParams.get("w")).toBe("100");
    expect(picked.sourceUrl.pathname).toBe("/teamlogo/night.png");
  });

  it("rejects a non-HLTV team-logo URL", () => {
    expect(() => assertHltvTeamLogoUrl("https://example.com/logo.png")).toThrow(
      "official HLTV teamlogo",
    );
  });

  it("requires the capture bundle to cover every Review Manual team exactly once", async () => {
    const reviewManual = await loadReviewManualManifest(reviewManualFile);
    const targets = listHltvTeamLogoTargets(reviewManual);
    expect(() =>
      validateHltvTeamLogoBundle(
        {
          capturedAt: "2026-08-18T08:00:00.000Z",
          notes: ["test"],
          records: [
            {
              contentType: "image/png",
              externalId: "12878",
              externalSlug: "bcgame",
              file: "bcgame.webp",
              name: "BC.Game",
              sha256: "a".repeat(64),
              shortName: "BCG",
              slug: "bcgame",
              sourceUrl:
                "https://img-cdn.hltv.org/teamlogo/example.png?ixlib=java-2.1.0&w=100&s=abc",
              teamPageUrl: "https://www.hltv.org/team/12878/bcgame",
              variant: "default",
            },
          ],
          version: 1,
        },
        targets,
      ),
    ).toThrow("exactly once");
  });
});
