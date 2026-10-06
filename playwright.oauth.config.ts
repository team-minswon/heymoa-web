import { defineConfig, devices } from "@playwright/test";

/**
 * 외부 에이전트 OAuth e2e(APP-888). 목을 끄고 가짜 API(`e2e/agent-oauth/fake-api.ts`)를 진짜 소켓으로 띄운다 —
 * 로그인 확인(SSR)과 토큰 갱신(`proxy.ts`)이 Node 쪽에서 API 를 불러 MSW 로는 재현되지 않는다.
 *
 * 인증 e2e(`playwright.auth.config.ts`)는 API 주소가 빈 것을 전제하므로 따로 둔다. 두 dev 서버가 이 워크트리의
 * `.next` 를 나눠 쓰므로 다른 e2e 와 동시에 돌리지 않는다.
 */
const WEB = "http://localhost:3102";
const API = "http://localhost:3199";

export default defineConfig({
  testDir: "./e2e/agent-oauth",
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: "list",
  use: { baseURL: WEB, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON e2e/agent-oauth/fake-api.ts",
      url: `${API}/__test/state`,
      reuseExistingServer: false,
      env: { FAKE_API_PORT: "3199", WEB_ORIGIN: WEB },
    },
    {
      command: "pnpm dev --port 3102",
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
