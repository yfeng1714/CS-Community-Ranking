const PRODUCTION_BUILD_PHASE = "phase-production-build";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === PRODUCTION_BUILD_PHASE) {
    return;
  }

  const [{ getEnv }, { getLogger }] = await Promise.all([
    import("@/config/env"),
    import("@/observability/logger"),
  ]);

  const env = getEnv();
  getLogger().info(
    {
      event: "application_start",
      activeEditionCode: env.ACTIVE_EDITION_CODE,
    },
    "Application configuration validated",
  );
}
