import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "jsdom",
    // Playwright 스펙은 vitest가 아니라 `pnpm test:e2e`가 돌린다. 여기서 걷어내지 않으면
    // vitest가 import해 "Playwright Test did not expect test() to be called here"로 깨진다.
    // node_modules는 `**/`로 잡는다 — 루트 상대 패턴은 중첩 node_modules를 못 거른다.
    // git worktree를 레포 안에 파면 그 안의 테스트가 통째로 딸려 들어온다. `.worktrees/`만
    // 걸렀더니 `.claude/worktrees/app-374-monorepo`의 87개가 섞여 803 → 1554건이 되고,
    // 같은 모듈이 두 벌 돌며 19개가 깨져 머지 게이트가 막혔다. 두 자리를 다 적는다 —
    // **`**/worktrees/**` 하나로 합칠 수 없다.** 점이 붙은 `.worktrees`를 못 잡아서
    // 오히려 원래 걸리던 것까지 풀린다(실제로 1606건까지 늘었다).
    exclude: [
      "**/node_modules/**",
      "e2e/**",
      "**/.worktrees/**",
      "**/worktrees/**",
    ],
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
  },
});
