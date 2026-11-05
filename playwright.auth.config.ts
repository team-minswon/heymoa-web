import { defineConfig, devices } from "@playwright/test";

// Run after the regular MSW suite: both dev servers use this worktree's .next.
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["auth-session-probe/**/*.spec.ts", "browser-handoff.spec.ts"],
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  reporter: "list",
  use: {
    // 화면 언어의 초기 기본값이 브라우저 언어다(APP-1285). Chromium 기본(en-US)이면 모든 시험이 영어 화면을 받으므로
    // 한국어 사용자로 고정한다. 영어 화면을 보는 시험은 자기 컨텍스트에 `locale: "en-US"` 를 준다.
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
