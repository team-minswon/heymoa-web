import { defineConfig, devices } from "@playwright/test";

// Run after the regular MSW suite: both dev servers use this worktree's .next.
export default defineConfig({
  testDir: "./e2e/auth-session-probe",
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  reporter: "list",
  use: { baseURL: "http://localhost:3101", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev --port 3101",
    url: "http://localhost:3101",
    reuseExistingServer: false,
    env: { NEXT_PUBLIC_API_MOCKING: "disabled", NEXT_PUBLIC_API_BASE_URL: "" },
    timeout: 120_000,
  },
});
