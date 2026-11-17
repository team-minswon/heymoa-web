import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: [
    "**/auth-session-probe/**",
    "**/agent-oauth/**",
    "**/browser-handoff.spec.ts",
  ],
  fullyParallel: true,
  workers: 4,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    locale: "ko-KR",
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm build && pnpm start --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_API_MOCKING: "enabled",
      NEXT_PUBLIC_API_BASE_URL: "",
      NEXT_PUBLIC_MOCK_LOCAL_PROJECTS: "disabled",
      VERCEL_ENV: "development",
    },
    timeout: 180_000,
  },
});
