import { describe, expect, it } from "vitest";

import { assertStagingBootstrapAllowed } from "../../scripts/staging-bootstrap-support.ts";

const railwayEnvironment = {
  APP_ORIGIN: "https://example-production.up.railway.app",
  NODE_ENV: "production",
  RAILWAY_ENVIRONMENT_ID: "environment-id",
  RAILWAY_PROJECT_ID: "project-id",
  RAILWAY_SERVICE_ID: "service-id",
};

describe("staging bootstrap guard", () => {
  it("allows an explicitly confirmed Railway-generated staging origin", () => {
    expect(() => assertStagingBootstrapAllowed(true, railwayEnvironment)).not.toThrow();
  });

  it("requires explicit confirmation", () => {
    expect(() => assertStagingBootstrapAllowed(false, railwayEnvironment)).toThrow(
      "--confirm-staging",
    );
  });

  it.each([
    ["custom host", { ...railwayEnvironment, APP_ORIGIN: "https://example.com" }],
    ["non-production runtime", { ...railwayEnvironment, NODE_ENV: "development" }],
    ["non-Railway runtime", { ...railwayEnvironment, RAILWAY_PROJECT_ID: undefined }],
  ])("rejects %s", (_label, environment) => {
    expect(() => assertStagingBootstrapAllowed(true, environment)).toThrow();
  });
});
