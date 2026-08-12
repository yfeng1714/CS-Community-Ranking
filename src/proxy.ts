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

  if (request.nextUrl.pathname.startsWith("/admin")) {
    response.headers.set("cache-control", "no-store");
    response.headers.set("content-security-policy", "frame-ancestors 'none'");
    response.headers.set("referrer-policy", "no-referrer");
    response.headers.set("x-content-type-options", "nosniff");
    response.headers.set("x-frame-options", "DENY");
    response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
