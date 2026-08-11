import { describe, expect, it } from "vitest";

import { validateMutationRequest } from "@/security/mutation-request";

const productionOptions = {
  appOrigin: "https://example.com",
  production: true,
};

function mutationRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/v1/example", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://example.com",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: "{}",
  });
}

describe("validateMutationRequest", () => {
  it("accepts a same-origin JSON POST", () => {
    expect(validateMutationRequest(mutationRequest(), productionOptions)).toEqual({ ok: true });
  });

  it("rejects a different origin", () => {
    expect(
      validateMutationRequest(
        mutationRequest({ origin: "https://attacker.example" }),
        productionOptions,
      ),
    ).toEqual({ ok: false, status: 403, code: "ORIGIN_REJECTED" });
  });

  it("rejects Fetch Metadata marked cross-site", () => {
    expect(
      validateMutationRequest(
        mutationRequest({ "sec-fetch-site": "cross-site" }),
        productionOptions,
      ),
    ).toEqual({ ok: false, status: 403, code: "CROSS_SITE_REJECTED" });
  });

  it("rejects form-encoded bodies", () => {
    expect(
      validateMutationRequest(
        mutationRequest({ "content-type": "application/x-www-form-urlencoded" }),
        productionOptions,
      ),
    ).toEqual({ ok: false, status: 415, code: "CONTENT_TYPE_REJECTED" });
  });

  it("allows an absent Origin only outside production", () => {
    const request = mutationRequest();
    request.headers.delete("origin");

    expect(
      validateMutationRequest(request, {
        appOrigin: "http://localhost:3000",
        production: false,
      }),
    ).toEqual({ ok: true });
  });
});
