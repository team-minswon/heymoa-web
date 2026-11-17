import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { packageManager } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);
if (!/^pnpm@\d+\.\d+\.\d+$/.test(packageManager)) {
  throw new Error("An exact pnpm packageManager version is required");
}
const result = spawnSync(
  "npx",
  ["--yes", packageManager, "install", "--frozen-lockfile"],
  {
    stdio: "inherit",
    env: { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: "1" },
  }
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
