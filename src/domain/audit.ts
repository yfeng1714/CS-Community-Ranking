import { adminAuditLogs } from "../db/schema/index.ts";
import type { AppTransaction } from "./database.ts";
import { requireNonBlank } from "./error.ts";

type JsonCompatible =
  null | boolean | number | string | JsonCompatible[] | { [key: string]: JsonCompatible };

function toJsonCompatible(value: unknown): JsonCompatible {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonCompatible(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJsonCompatible(item)]),
    );
  }

  return String(value);
}

export function toAuditRecord(value: object | null | undefined): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return null;
  }

  return toJsonCompatible(value) as Record<string, unknown>;
}

export async function writeAdminAudit(
  transaction: AppTransaction,
  input: {
    actorAdminUserId: bigint;
    action: string;
    targetType: string;
    targetId: string;
    reason: string;
    before?: object | null;
    after?: object | null;
  },
): Promise<void> {
  await transaction.insert(adminAuditLogs).values({
    action: requireNonBlank(input.action, "audit action"),
    actorAdminUserId: input.actorAdminUserId,
    after: toAuditRecord(input.after),
    before: toAuditRecord(input.before),
    reason: requireNonBlank(input.reason, "audit reason"),
    targetId: requireNonBlank(input.targetId, "audit target ID"),
    targetType: requireNonBlank(input.targetType, "audit target type"),
  });
}
