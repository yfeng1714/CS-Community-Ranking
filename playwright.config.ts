import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 15_000 },
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  workers: process.env.CI ? 2 : 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command:
      "node --env-file=.env scripts/e2e-setup.ts && node node_modules/next/dist/bin/next build --webpack && node scripts/e2e-server.ts",
    env: {
      ADMIN_SESSION_SECRET: "e2e-admin-session-secret-not-for-production",
      IP_HMAC_SECRET: "e2e-ip-hmac-secret-not-for-production-use",
      VISITOR_TOKEN_HASH_PEPPER: "e2e-visitor-token-pepper-not-for-production",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    url: "http://localhost:3000/api/health/live",
  },
});
