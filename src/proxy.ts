import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getOrCreateRequestId, REQUEST_ID_HEADER } from "@/observability/request-id";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const requestId = getOrCreateRequestId(requestHeaders.get(REQUEST_ID_HEADER));

  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set(REQUEST_ID_HEADER, requestId);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
