import { defineConfig, devices } from "@playwright/test";

/**
 * vitest는 jsdom이라 MSW의 브라우저 서비스 워커 경로(`worker.start()`)를 한 번도 지나지 않는다.
 * Vercel `dev` 배포가 정확히 그 경로로 도는데도 그렇다 — 여기를 이 스모크가 덮는다.
 *
 * 기본 dev 포트(3000)를 피해 3100을 쓴다. 개발 중인 서버를 죽이지 않기 위해서다.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    env: { NEXT_PUBLIC_API_MOCKING: "enabled" },
    timeout: 120_000,
  },
});
