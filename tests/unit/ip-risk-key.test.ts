import { describe, expect, it } from "vitest";

import {
  deriveDailyIpRiskKey,
  extractDailyIpRiskKey,
  normalizeIpForRisk,
} from "@/security/ip-risk-key";

describe("daily IP risk keys", () => {
  it("normalizes IPv4 and aggregates IPv6 privacy addresses at /64", () => {
    expect(normalizeIpForRisk("192.0.2.7")).toBe("192.0.2.7");
    expect(normalizeIpForRisk("::ffff:192.0.2.7")).toBe("192.0.2.7");
    expect(normalizeIpForRisk("2001:db8:1234:5678:1111:2222:3333:4444")).toBe(
      "2001:0db8:1234:5678::/64",
    );
    expect(normalizeIpForRisk("2001:db8:1234:5678::99")).toBe("2001:0db8:1234:5678::/64");
    expect(normalizeIpForRisk("not-an-ip")).toBeNull();
  });

  it("rotates HMAC keys by date and never returns the raw address", () => {
    const secret = "test-ip-hmac-secret-with-at-least-32-characters";
    const first = deriveDailyIpRiskKey({ date: "2026-08-12", ip: "192.0.2.7", secret });
    const second = deriveDailyIpRiskKey({ date: "2026-08-13", ip: "192.0.2.7", secret });
    expect(first).toHaveLength(32);
    expect(second).toHaveLength(32);
    expect(first).not.toEqual(second);
    expect(first?.toString("utf8")).not.toContain("192.0.2.7");
  });

  it("ignores identity headers unless the configured proxy is trusted", () => {
    const headers = new Headers({ "x-real-ip": "192.0.2.7" });
    const options = {
      clientIpMode: "railway" as const,
      now: new Date("2026-08-12T08:00:00Z"),
      secret: "test-ip-hmac-secret-with-at-least-32-characters",
      timeZone: "Asia/Shanghai",
    };
    expect(extractDailyIpRiskKey(headers, { ...options, trustProxyHeaders: false })).toBeNull();
    expect(extractDailyIpRiskKey(headers, { ...options, trustProxyHeaders: true })).toHaveLength(
      32,
    );
  });
});
