export type MutationRejectionCode =
  "METHOD_NOT_ALLOWED" | "CONTENT_TYPE_REJECTED" | "ORIGIN_REJECTED" | "CROSS_SITE_REJECTED";

export type MutationGuardResult =
  | { ok: true }
  | {
      ok: false;
      status: 403 | 405 | 415;
      code: MutationRejectionCode;
    };

interface MutationGuardOptions {
  appOrigin: string;
  production: boolean;
}

export function validateMutationRequest(
  request: Pick<Request, "method" | "headers">,
  options: MutationGuardOptions,
): MutationGuardResult {
  if (request.method !== "POST") {
    return { ok: false, status: 405, code: "METHOD_NOT_ALLOWED" };
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return { ok: false, status: 415, code: "CONTENT_TYPE_REJECTED" };
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") {
    return { ok: false, status: 403, code: "CROSS_SITE_REJECTED" };
  }

  const requestOrigin = request.headers.get("origin");
  if ((options.production || requestOrigin !== null) && requestOrigin !== options.appOrigin) {
    return { ok: false, status: 403, code: "ORIGIN_REJECTED" };
  }

  return { ok: true };
}

export function mutationRejectionResponse(
  rejection: Exclude<MutationGuardResult, { ok: true }>,
): Response {
  return Response.json(
    {
      error: {
        code: rejection.code,
        message: "Request rejected",
      },
    },
    {
      status: rejection.status,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
