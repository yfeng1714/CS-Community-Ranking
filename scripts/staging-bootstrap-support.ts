type BootstrapEnvironment = Record<string, string | undefined>;

export function assertStagingBootstrapAllowed(
  confirmed: boolean,
  environment: BootstrapEnvironment,
): void {
  if (!confirmed) throw new Error("--confirm-staging is required");
  if (environment.NODE_ENV !== "production") {
    throw new Error("Staging bootstrap requires NODE_ENV=production");
  }

  const origin = environment.APP_ORIGIN ? new URL(environment.APP_ORIGIN) : null;
  if (
    !origin ||
    origin.protocol !== "https:" ||
    !origin.hostname.endsWith(".up.railway.app") ||
    origin.origin !== environment.APP_ORIGIN
  ) {
    throw new Error("Staging bootstrap requires an exact Railway-generated HTTPS APP_ORIGIN");
  }

  for (const key of ["RAILWAY_PROJECT_ID", "RAILWAY_ENVIRONMENT_ID", "RAILWAY_SERVICE_ID"]) {
    if (!environment[key]) throw new Error(`Staging bootstrap requires ${key}`);
  }
}
