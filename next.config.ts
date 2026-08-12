import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";
export function contentSecurityPolicy(isProduction: boolean): string {
  const scriptPolicy = isProduction
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  return `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; ${scriptPolicy}; style-src 'self' 'unsafe-inline'; connect-src 'self'`;
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy(production),
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
] as const;

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["pg", "pino"],
  async headers() {
    return [
      { headers: [...securityHeaders], source: "/:path*" },
      ...(production
        ? [
            {
              headers: [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ],
              source: "/:path*",
              has: [{ key: "x-forwarded-proto", type: "header" as const, value: "https" }],
            },
          ]
        : []),
    ];
  },
};

export default nextConfig;
