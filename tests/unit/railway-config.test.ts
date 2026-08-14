import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

interface RailwayConfig {
  build: { dockerfilePath: string };
  deploy: {
    cronSchedule?: string;
    healthcheckPath?: string;
    multiRegionConfig?: Record<string, { numReplicas: number }>;
    preDeployCommand?: string[];
    restartPolicyType: string;
    startCommand: string;
  };
}

const root = process.cwd();
const scheduledConfigs = [
  "job-expire-ballots.json",
  "job-integrity-check.json",
  "job-retention-cleanup.json",
  "job-snapshot-ranking.json",
  "job-sync-vrs.json",
  "report-kpi.json",
] as const;

async function readConfig(name: string): Promise<RailwayConfig> {
  return JSON.parse(await readFile(path.join(root, "railway", name), "utf8")) as RailwayConfig;
}

describe("Railway config-as-code", () => {
  it("ships the reviewed launch and canonical inputs used by trusted commands", async () => {
    const dockerfile = await readFile(path.join(root, "Dockerfile"), "utf8");

    expect(dockerfile).toContain("/app/assets ./assets");
    expect(dockerfile).toContain("/app/data ./data");
  });

  it("migration-gates the single Singapore web replica and checks database readiness", async () => {
    const config = await readConfig("web.json");

    expect(config.build.dockerfilePath).toBe("Dockerfile");
    expect(config.deploy.healthcheckPath).toBe("/api/health/ready");
    expect(config.deploy.multiRegionConfig).toEqual({
      "asia-southeast1-eqsg3a": { numReplicas: 1 },
    });
    expect(config.deploy.preDeployCommand).toEqual([
      "node --import ./scripts/register-path-aliases.mjs scripts/migrate.ts",
    ]);
    expect(config.deploy.startCommand).toBe("node server.js");
  });

  it.each(scheduledConfigs)("keeps %s short-lived and separate from web", async (name) => {
    const config = await readConfig(name);

    expect(config.build.dockerfilePath).toBe("Dockerfile");
    expect(config.deploy.cronSchedule).toMatch(/^[-*/\d, ]+$/);
    expect(config.deploy.healthcheckPath).toBeUndefined();
    expect(config.deploy.preDeployCommand).toBeUndefined();
    expect(config.deploy.restartPolicyType).toBe("NEVER");
    expect(config.deploy.startCommand).toContain("register-path-aliases.mjs");
    expect(config.deploy.startCommand).not.toContain("server.js");
  });
});
