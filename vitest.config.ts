import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "jsdom",
    maxWorkers: 4,
    exclude: [
      "**/node_modules/**",
      "e2e/**",
      "apps/desktop/**",
      "**/.worktrees/**",
      "**/worktrees/**",
    ],
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
  },
});
