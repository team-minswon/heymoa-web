import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "jsdom",
    // Playwright 스펙은 vitest가 아니라 `pnpm test:e2e`가 돌린다. 여기서 걷어내지 않으면
    // vitest가 import해 "Playwright Test did not expect test() to be called here"로 깨진다.
    exclude: ["node_modules/**", "e2e/**"],
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
  },
});
