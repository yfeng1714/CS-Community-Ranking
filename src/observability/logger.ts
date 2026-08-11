import pino, { type Logger } from "pino";

import { getEnv } from "@/config/env";

let logger: Logger | undefined;

export function getLogger(): Logger {
  if (!logger) {
    const env = getEnv();

    logger = pino({
      level: env.LOG_LEVEL,
      base: {
        service: "cs-community-ranking",
        environment: env.NODE_ENV,
      },
      redact: {
        paths: [
          "req.headers.cookie",
          "request.headers.cookie",
          "visitorToken",
          "adminSessionToken",
          "password",
          "DATABASE_URL",
        ],
        censor: "[REDACTED]",
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  return logger;
}
