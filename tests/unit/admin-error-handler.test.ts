import { describe, expect, it, vi } from "vitest";

import { handleAdminError } from "@/app/api/v1/admin/shared";

describe("admin database error mapping", () => {
  it.each([
    ["23505", 409, "ADMIN_DATA_CONFLICT"],
    ["23503", 409, "ADMIN_INVALID_REFERENCE"],
    ["23514", 400, "INVALID_ADMIN_INPUT"],
  ])("maps PostgreSQL %s without exposing internals", async (code, status, responseCode) => {
    const onUnexpectedError = vi.fn();
    const response = handleAdminError(
      { code, detail: "sensitive database detail" },
      onUnexpectedError,
    );

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({
      error: { code: responseCode, message: expect.not.stringContaining("sensitive") },
    });
    expect(onUnexpectedError).not.toHaveBeenCalled();
  });
});
