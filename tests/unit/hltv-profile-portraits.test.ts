import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertHltvPlayerBodyshotUrl,
  listHltvProfilePortraitTargets,
  portraitAssetPath,
  validateHltvProfilePortraitBundle,
} from "@/domain/assets/hltv-profile-portraits";
import { loadReviewManualManifest } from "@/domain/pool/review-manual-manifest";
import { loadSpecialRetiredManifest } from "@/domain/pool/special-retired-manifest";

const reviewManualFile = path.resolve("data/review-manual/2026-08-17.json");
const specialRetiredFile = path.resolve("data/review-manual/special-retired-2026-08-17.json");

describe("HLTV profile portrait targets", () => {
  it("lists the 20 Review Manual players plus advent and skips MachineWJQ", async () => {
    const reviewManual = await loadReviewManualManifest(reviewManualFile);
    const specialRetired = await loadSpecialRetiredManifest(specialRetiredFile);
    const targets = listHltvProfilePortraitTargets({ reviewManual, specialRetired });
    expect(targets.map((target) => target.slug)).toEqual([
      "s1mple",
      "electronic",
      "magisk",
      "senzu",
      "mzinho",
      "device",
      "rain",
      "gizmy",
      "sirah",
      "poiii",
      "jamyoung",
      "jee",
      "mercury",
      "moseyuh",
      "zero",
      "westmelon",
      "z4kr",
      "starry",
      "emiliaqaq",
      "c4llm3su3",
      "advent",
    ]);
    expect(targets.every((target) => target.slug !== "machinewjq")).toBe(true);
    expect(portraitAssetPath("advent")).toBe("/images/players/advent.webp");
  });

  it("rejects a non-HLTV portrait URL", async () => {
    const reviewManual = await loadReviewManualManifest(reviewManualFile);
    const specialRetired = await loadSpecialRetiredManifest(specialRetiredFile);
    const [player] = listHltvProfilePortraitTargets({ reviewManual, specialRetired });
    expect(() => assertHltvPlayerBodyshotUrl("https://example.com/photo.png", player!)).toThrow(
      "official HLTV playerbodyshot",
    );
  });

  it("requires the capture bundle to cover every target exactly once", async () => {
    const reviewManual = await loadReviewManualManifest(reviewManualFile);
    const specialRetired = await loadSpecialRetiredManifest(specialRetiredFile);
    const targets = listHltvProfilePortraitTargets({ reviewManual, specialRetired });
    expect(() =>
      validateHltvProfilePortraitBundle(
        {
          capturedAt: "2026-08-18T06:00:00.000Z",
          notes: ["test"],
          records: [
            {
              contentType: "image/png",
              externalId: "7998",
              externalSlug: "s1mple",
              file: "s1mple.webp",
              nickname: "s1mple",
              profileUrl: "https://www.hltv.org/player/7998/s1mple",
              sha256: "a".repeat(64),
              slug: "s1mple",
              source: "REVIEW_MANUAL",
              sourceUrl:
                "https://img-cdn.hltv.org/playerbodyshot/example.png?ixlib=java-2.1.0&w=400&s=abc",
            },
          ],
          version: 1,
        },
        targets,
      ),
    ).toThrow("exactly once");
  });
});
