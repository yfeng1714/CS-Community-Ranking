import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import type { AppEnv } from "@/config/env";
import { DomainError } from "@/domain/error";
import type { AdminSessionService } from "@/domain/admin/auth";
import { mutationRejectionResponse, validateMutationRequest } from "@/security/mutation-request";

export function adminErrorResponse(code: string, message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { headers: { "cache-control": "no-store" }, status },
  );
}

export function handleAdminError(error: unknown, onUnexpectedError?: (error: unknown) => void) {
  if (error instanceof ZodError) {
    return adminErrorResponse("INVALID_ADMIN_INPUT", "Check the submitted fields", 400);
  }
  if (error instanceof DomainError) {
    if (error.code === "INVALID_ADMIN_CREDENTIALS") {
      return adminErrorResponse(error.code, error.message, 401);
    }
    const status = error.code.endsWith("_NOT_FOUND") ? 404 : 409;
    return adminErrorResponse(error.code, error.message, status);
  }
  const postgresCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : null;
  if (postgresCode === "23505") {
    return adminErrorResponse(
      "ADMIN_DATA_CONFLICT",
      "That value conflicts with an existing record",
      409,
    );
  }
  if (postgresCode === "23503") {
    return adminErrorResponse(
      "ADMIN_INVALID_REFERENCE",
      "A referenced record does not exist or cannot be changed",
      409,
    );
  }
  if (["22001", "22003", "22007", "23514"].includes(postgresCode ?? "")) {
    return adminErrorResponse("INVALID_ADMIN_INPUT", "Check the submitted fields", 400);
  }
  onUnexpectedError?.(error);
  return adminErrorResponse("ADMIN_OPERATION_FAILED", "The admin operation failed", 500);
}

export function guardAdminMutation(request: NextRequest, env: AppEnv): Response | null {
  const guard = validateMutationRequest(request, {
    appOrigin: env.APP_ORIGIN,
    production: env.NODE_ENV === "production",
  });
  return guard.ok ? null : mutationRejectionResponse(guard);
}

export async function authenticateAdminRequest(
  request: NextRequest,
  env: AppEnv,
  sessions: Pick<AdminSessionService, "authenticate">,
) {
  return sessions.authenticate(request.cookies.get(env.ADMIN_SESSION_COOKIE_NAME)?.value);
}
