import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "jsdom",
    // Playwright 스펙은 vitest가 아니라 `pnpm test:e2e`가 돌린다. 여기서 걷어내지 않으면
    // vitest가 import해 "Playwright Test did not expect test() to be called here"로 깨진다.
    // node_modules는 `**/`로 잡는다 — 루트 상대 패턴은 중첩 node_modules를 못 거른다.
    // git worktree를 레포 안(.worktrees/)에 파면 그 안의 의존성 테스트 수천 개가 딸려 들어온다.
    exclude: ["**/node_modules/**", "e2e/**", ".worktrees/**"],
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
  },
});
