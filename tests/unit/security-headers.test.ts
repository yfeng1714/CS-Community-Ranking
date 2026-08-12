import { describe, expect, it } from "vitest";

import { contentSecurityPolicy } from "../../next.config";

describe("site security headers", () => {
  it("uses a restrictive production CSP without development eval", () => {
    const policy = contentSecurityPolicy(true);
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("allows eval only for the Next.js development debugger", () => {
    expect(contentSecurityPolicy(false)).toContain("'unsafe-eval'");
  });
});
