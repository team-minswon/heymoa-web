const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const script = fs.readFileSync(path.join(__dirname, "../scripts/verify-package.cjs"), "utf8");
const shippedModules = ["main", "preload", "policy", "security", "recording-lifecycle", "recording-tray", "auth", "auth-policy", "auth-session", "media-grant", "capture-host", "capture-protocol", "capture-preload", "capture-renderer", "pcm-capture-worklet"];
const packagePaths = ["\\dist", ...shippedModules.map((name) => `\\dist\\${name}.js`), "\\dist\\capture.html", "\\package.json", "\\LICENSE.txt", "\\assets", "\\assets\\trayTemplate.png", "\\assets\\trayTemplate@2x.png", "\\assets\\tray.png"];
function inspect(paths) {
  let archive;
  vm.runInNewContext(script, {
    __dirname: path.join(__dirname, "../scripts"),
    require(name) {
      if (name === "node:fs") return { readdirSync: () => [{ name: "win-unpacked", isDirectory: () => true }], statSync: () => ({ size: 1 }) };
      if (name === "node:path") return path;
      if (name === "@electron/asar") return { listPackage: (value) => { archive = value; return paths; } };
      throw new Error(`Unexpected module ${name}`);
    },
    console: { log() {} },
  });
  return archive;
}
test("Windows-native ASAR separators pass the shipping allowlist and inspect Windows resources", () => {
  assert.ok(inspect(packagePaths).endsWith(path.join("win-unpacked", "resources", "app.asar")));
});
test("Windows normalization still rejects web source, secrets and missing authentication modules", () => {
  assert.throws(() => inspect([...packagePaths, "\\.env"]), /Unexpected/);
  assert.throws(() => inspect([...packagePaths, "\\app\\page.tsx"]), /Unexpected/);
  assert.throws(() => inspect(packagePaths.filter((file) => file !== "\\dist\\auth.js")), /Missing/);
});
