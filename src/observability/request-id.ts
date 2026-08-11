import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function getOrCreateRequestId(candidate: string | null | undefined): string {
  if (candidate && SAFE_REQUEST_ID.test(candidate)) {
    return candidate;
  }

  return randomUUID();
}
