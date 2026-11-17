import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = process.env.E2E_WEB_PORT ?? "3102";
const API_PORT = process.env.E2E_API_PORT ?? "3199";
const WEB = `http://localhost:${WEB_PORT}`;
const API = `http://localhost:${API_PORT}`;

export default defineConfig({
  testDir: "./e2e/agent-oauth",
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    locale: "ko-KR",
    baseURL: WEB,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON e2e/agent-oauth/fake-api.ts",
      url: `${API}/__test/state`,
      reuseExistingServer: false,
      env: { FAKE_API_PORT: API_PORT, WEB_ORIGIN: WEB },
    },
    {
      command: `pnpm dev --port ${WEB_PORT}`,
      url: WEB,
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_API_MOCKING: "disabled",
        NEXT_PUBLIC_API_BASE_URL: API,
      },
      timeout: 120_000,
    },
  ],
});
