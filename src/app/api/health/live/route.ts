import { createLivenessResponse } from "./health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): Response {
  return createLivenessResponse();
}
