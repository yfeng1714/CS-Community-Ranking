import { z } from "zod";

const PRODUCTION_PLACEHOLDERS = new Set([
  "replace-with-at-least-32-random-characters",
  "replace-with-a-different-32-character-secret",
  "replace-with-another-32-character-secret",
]);

const booleanFromEnvironment = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  if (value.toLowerCase() === "true") {
    return true;
  }

  if (value.toLowerCase() === "false") {
    return false;
  }

  return value;
}, z.boolean());

const positiveIntegerFromEnvironment = z.preprocess((value) => {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return value;
}, z.number().int().positive());

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.url().optional());

const origin = z.url().refine((value) => new URL(value).origin === value, {
  message: "must be an origin without a path, query, fragment, or trailing slash",
});

const postgresUrl = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "postgres:" || protocol === "postgresql:";
}, "must use the postgres or postgresql protocol");

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_ORIGIN: origin,
    DATABASE_URL: postgresUrl,
    APP_TIME_ZONE: z.literal("Asia/Shanghai").default("Asia/Shanghai"),
    PORT: positiveIntegerFromEnvironment.default(3000),

    VISITOR_COOKIE_NAME: z.string().min(1).default("__Host-csr_visitor"),
    VISITOR_COOKIE_MAX_AGE_DAYS: positiveIntegerFromEnvironment.default(365),
    VISITOR_TOKEN_HASH_PEPPER: z.string().min(32),
    IP_HMAC_SECRET: z.string().min(32),
    ADMIN_SESSION_SECRET: z.string().min(32),

    ACTIVE_EDITION_CODE: z
      .string()
      .regex(/^\d{4}$/)
      .default("2026"),
    DEFAULT_FULL_WEIGHT_BALLOTS_PER_DAY: positiveIntegerFromEnvironment.default(50),
    DEFAULT_BALLOT_TTL_MINUTES: positiveIntegerFromEnvironment.default(30),
    RISK_ENFORCEMENT_MODE: z.enum(["observe", "enforce"]).default("observe"),
    IP_RISK_KEY_RETENTION_DAYS: positiveIntegerFromEnvironment.default(90),
    PRODUCT_EVENT_RETENTION_DAYS: positiveIntegerFromEnvironment.default(90),

    CLIENT_IP_MODE: z.enum(["railway", "cloudflare"]).default("railway"),
    TRUST_PROXY_HEADERS: booleanFromEnvironment.default(false),

    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    SENTRY_DSN: optionalUrl,

    HLTV_SYNC_ENABLED: booleanFromEnvironment.default(false),
    HLTV_REQUEST_DELAY_MS: positiveIntegerFromEnvironment.default(3000),
    HLTV_USER_AGENT: optionalNonEmptyString,
    VRS_SOURCE_URL: optionalUrl,

    ADMIN_BOOTSTRAP_USERNAME: optionalNonEmptyString,
    ADMIN_BOOTSTRAP_PASSWORD_HASH: optionalNonEmptyString,
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === "production") {
      for (const key of [
        "VISITOR_TOKEN_HASH_PEPPER",
        "IP_HMAC_SECRET",
        "ADMIN_SESSION_SECRET",
      ] as const) {
        if (PRODUCTION_PLACEHOLDERS.has(env[key])) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: "must not use the documented development placeholder in production",
          });
        }
      }

      if (!env.VISITOR_COOKIE_NAME.startsWith("__Host-")) {
        context.addIssue({
          code: "custom",
          path: ["VISITOR_COOKIE_NAME"],
          message: "must use the __Host- prefix in production",
        });
      }
    }

    if (env.TRUST_PROXY_HEADERS === true && !env.CLIENT_IP_MODE) {
      context.addIssue({
        code: "custom",
        path: ["CLIENT_IP_MODE"],
        message: "must be explicitly selected when proxy headers are trusted",
      });
    }

    if (env.HLTV_SYNC_ENABLED === true && !env.HLTV_USER_AGENT) {
      context.addIssue({
        code: "custom",
        path: ["HLTV_USER_AGENT"],
        message: "is required when HLTV sync is enabled",
      });
    }

    const bootstrapFields = [env.ADMIN_BOOTSTRAP_USERNAME, env.ADMIN_BOOTSTRAP_PASSWORD_HASH];
    if (bootstrapFields.filter(Boolean).length === 1) {
      context.addIssue({
        code: "custom",
        path: ["ADMIN_BOOTSTRAP_USERNAME"],
        message: "username and password hash must be provided together",
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export class EnvironmentValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid environment configuration:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "EnvironmentValidationError";
  }
}

export function parseEnv(input: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "environment";
      return `${path}: ${issue.message}`;
    });

    throw new EnvironmentValidationError(issues);
  }

  return result.data;
}

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  cachedEnv ??= parseEnv(process.env);
  return cachedEnv;
}

export function clearEnvCacheForTests(): void {
  cachedEnv = undefined;
}
