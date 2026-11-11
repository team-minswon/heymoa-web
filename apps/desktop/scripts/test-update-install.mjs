// Disposable CI machines only: install a signed/NSIS baseline and exercise a real in-app upgrade.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";
import { extractFile, uncache } from "@electron/asar";

if (!process.env.CI)
  throw new Error("Run installation QA only on disposable CI machines");
const require = createRequire(import.meta.url);
const desktop = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const release = path.resolve(process.argv[2]);
const qa = mkdtempSync(path.join(os.tmpdir(), "heymoa-install-qa-"));
const mac = process.platform === "darwin";
const version = JSON.parse(
  readFileSync(path.join(desktop, "package.json"))
).version;
const baseline = "0.0.1";
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    timeout: 600_000,
    ...options,
  });
  if (result.status !== 0)
    throw new Error(`QA command failed: ${command} (${result.status})`);
}
const output = path.join(qa, "build");
const target = path.join(qa, "installed");
const executable = mac
  ? path.join(output, "mac-arm64/HeyMoa.app/Contents/MacOS/HeyMoa")
  : path.join(target, "HeyMoa.exe");
let application;
let server;
async function closeApplication() {
  const closed = application.waitForEvent("close", { timeout: 30_000 });
  await application.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await closed;
  application = null;
}
function stopRelaunchedApp() {
  if (mac)
    spawnSync(
      "pkill",
      ["-f", executable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")],
      { stdio: "ignore" }
    );
  else
    spawnSync("taskkill", ["/F", "/IM", "HeyMoa.exe", "/T"], {
      stdio: "ignore",
    });
}
try {
  const args = [
    require.resolve("electron-builder/cli.js"),
    mac ? "--mac" : "--win",
    mac ? "--dir" : "nsis",
    mac ? "--arm64" : "--x64",
    "--publish",
    "never",
    `--config.extraMetadata.version=${baseline}`,
    `--config.directories.output=${output}`,
  ];
  if (mac) args.push("--config.mac.notarize=false");
  run(process.execPath, args, { cwd: desktop });
  if (!mac)
    run(path.join(output, `HeyMoa-${baseline}-win-x64.exe`), [
      "/S",
      `/D=${target}`,
    ]);
  application = await electron.launch({
    executablePath: executable,
    timeout: 60_000,
  });
  const profile = await application.evaluate(({ app }) =>
    app.getPath("userData")
  );
  // Skip onboarding in this isolated runner without involving any real user's login or microphone.
  writeFileSync(
    path.join(profile, "onboarding.json"),
    JSON.stringify({ version: 1, completed: true })
  );
  writeFileSync(path.join(profile, "update-qa-marker"), "preserved");
  await closeApplication();
  application = await electron.launch({
    executablePath: executable,
    timeout: 60_000,
  });
  const page = await application.firstWindow();
  await page.waitForURL((url) => url.origin === "https://heymoa.app", {
    timeout: 60_000,
  });
  await page.waitForFunction(
    () => Boolean(window.heymoaDesktop?.getUpdateState),
    null,
    { timeout: 60_000 }
  );
  server = http.createServer((request, response) => {
    const name = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname.slice(1)
    );
    if (
      !/^(?:latest(?:-mac)?\.yml|HeyMoa-[\w.-]+\.(?:zip|exe|dmg)(?:\.blockmap)?)$/.test(
        name
      ) ||
      !existsSync(path.join(release, name))
    ) {
      response.writeHead(404).end();
      return;
    }
    const file = path.join(release, name);
    response.writeHead(200, { "Content-Length": statSync(file).size });
    createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  await application.evaluate(({ app }, url) => {
    const nativeRequire = process.mainModule.require.bind(process.mainModule);
    const updater = nativeRequire(
      nativeRequire("node:path").join(
        app.getAppPath(),
        "dist/update-runtime.js"
      )
    ).autoUpdater;
    updater.disableDifferentialDownload = true;
    updater.setFeedURL({ provider: "generic", url });
  }, `http://127.0.0.1:${server.address().port}`);
  await page.setContent(
    '<button id="check">Check</button><button id="restart">Restart</button>'
  );
  await page.evaluate(() => {
    const bridge = window.heymoaDesktop;
    bridge.subscribeUpdates((state) => {
      document.body.dataset.status = state.status;
    });
    document.getElementById("check").onclick = () => bridge.checkForUpdates();
    document.getElementById("restart").onclick = () =>
      bridge.restartForUpdate();
  });
  const report = async (phase, pendingMs = 0) =>
    page.evaluate(
      ({ phase, pendingMs }) =>
        window.heymoaDesktop.reportRecording({
          phase,
          pendingMs,
          startedAt: null,
          microphone: null,
          systemAudio: null,
        }),
      { phase, pendingMs }
    );
  await report("recording");
  await page.locator("#check").click();
  await page.waitForFunction(
    () => document.body.dataset.status === "ready",
    null,
    { timeout: 120_000 }
  );
  await page.locator("#restart").click();
  assert.equal(
    await page.evaluate(
      async () => (await window.heymoaDesktop.getUpdateState()).status
    ),
    "ready"
  );
  await report("failed", 1000);
  await page.locator("#restart").click();
  assert.equal(
    await page.evaluate(
      async () => (await window.heymoaDesktop.getUpdateState()).status
    ),
    "ready"
  );
  await report("idle");
  const closed = application.waitForEvent("close", { timeout: 150_000 });
  await page.locator("#restart").click();
  await closed;
  application = null;
  const archive = mac
    ? path.resolve(executable, "../../Resources/app.asar")
    : path.join(target, "resources/app.asar");
  const deadline = Date.now() + 120_000;
  let installed;
  while (Date.now() < deadline) {
    try {
      uncache(archive);
      installed = JSON.parse(
        extractFile(archive, "package.json").toString()
      ).version;
    } catch {}
    if (installed === version) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal(
    installed,
    version,
    "the real installer must replace the baseline application"
  );
  stopRelaunchedApp();
  application = await electron.launch({
    executablePath: executable,
    timeout: 60_000,
  });
  assert.equal(
    await application.evaluate(({ app }) => app.getVersion()),
    version
  );
  assert.equal(
    readFileSync(path.join(profile, "update-qa-marker"), "utf8"),
    "preserved"
  );
  await closeApplication();
  console.log(
    `Real update installation passed on ${process.platform}: ${baseline} -> ${version}; recording and pending audio blocked; profile preserved.`
  );
} finally {
  if (application)
    await application.evaluate(({ app }) => app.exit(1)).catch(() => {});
  stopRelaunchedApp();
  if (server) server.close();
  rmSync(qa, { recursive: true, force: true, maxRetries: 5 });
}
