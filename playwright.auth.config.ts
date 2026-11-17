import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["auth-session-probe/**/*.spec.ts", "browser-handoff.spec.ts"],
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  reporter: "list",
  use: {
    locale: "ko-KR",
    baseURL: "http://localhost:3101",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev --port 3101",
    url: "http://localhost:3101",
    reuseExistingServer: false,
    env: { NEXT_PUBLIC_API_MOCKING: "disabled", NEXT_PUBLIC_API_BASE_URL: "" },
    timeout: 120_000,
  },
});
