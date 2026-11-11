// Disposable CI machines only: install a signed/NSIS baseline and exercise a real in-app upgrade.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdtempSync,
  mkdirSync,
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
assert.ok(
  mac || Number(os.release().split(".")[2]) >= 22000,
  "Installation QA must run on an OS supported by the app (Windows build 22000 or newer)"
);
const version = JSON.parse(
  readFileSync(path.join(desktop, "package.json"))
).version;
const baseline = "0.0.1";
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    timeout: 600_000,
    env: { ...process.env, npm_config_user_agent: "pnpm/10.30.1" },
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
async function launchApplication() {
  stopRelaunchedApp();
  const launched = await electron.launch({
    executablePath: executable,
    timeout: 60_000,
  });
  launched.process().stdout?.on("data", (data) => process.stdout.write(data));
  launched.process().stderr?.on("data", (data) => process.stderr.write(data));
  return launched;
}
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
  // Startup checks must use the disposable local feed, including the default-on first launch.
  const baselineConfig = path.join(qa, "baseline.json");
  writeFileSync(
    baselineConfig,
    JSON.stringify({
      ...JSON.parse(readFileSync(path.join(desktop, "package.json"))).build,
      publish: [
        {
          provider: "generic",
          url: `http://127.0.0.1:${server.address().port}`,
        },
      ],
    })
  );
  const args = [
    require.resolve("electron-builder/cli.js"),
    mac ? "--mac" : "--win",
    mac ? "zip" : "nsis",
    mac ? "--arm64" : "--x64",
    "--publish",
    "never",
    `--config=${baselineConfig}`,
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
  assert.ok(
    existsSync(
      mac
        ? path.resolve(executable, "../../Resources/app-update.yml")
        : path.join(target, "resources/app-update.yml")
    ),
    "The baseline must include the same updater configuration as a distributed app"
  );
  application = await launchApplication();
  const profile = await application.evaluate(({ app }) =>
    app.getPath("userData")
  );
  mkdirSync(profile, { recursive: true });
  // Skip onboarding in this isolated runner without involving any real user's login or microphone.
  writeFileSync(
    path.join(profile, "onboarding.json"),
    JSON.stringify({ version: 1, completed: true })
  );
  writeFileSync(path.join(profile, "update-qa-marker"), "preserved");
  writeFileSync(
    path.join(profile, "updates.json"),
    JSON.stringify({ automatic: false })
  );
  writeFileSync(
    path.join(profile, "meeting-panel.json"),
    JSON.stringify({
      pinned: true,
      opacity: 0.75,
      position: { x: 100, y: 100 },
    })
  );
  await closeApplication();
  application = await launchApplication();
  const page = await application.firstWindow();
  await page.waitForURL((url) => url.origin === "https://heymoa.app", {
    timeout: 60_000,
  });
  await page.waitForFunction(
    () => Boolean(window.heymoaDesktop?.getUpdateState),
    null,
    { timeout: 60_000 }
  );
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
  // A fresh trusted document avoids the live site's React/auth effects replacing the QA controls.
  await page.waitForLoadState("load");
  await page.route("https://heymoa.app/__update-qa", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<button id="check">Check</button><button id="restart">Restart</button>',
    })
  );
  await page.goto("https://heymoa.app/__update-qa");
  page.on("console", (message) => console.log("QA renderer:", message.text()));
  page.on("pageerror", (error) => console.error("QA renderer error:", error));
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
    () => ["ready", "error"].includes(document.body.dataset.status),
    null,
    { timeout: 120_000 }
  );
  assert.equal(
    await page.evaluate(() => document.body.dataset.status),
    "ready",
    "download must complete without an updater error"
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
  application = await launchApplication();
  assert.equal(
    await application.evaluate(({ app }) => app.getVersion()),
    version
  );
  assert.equal(
    readFileSync(path.join(profile, "update-qa-marker"), "utf8"),
    "preserved"
  );
  assert.equal(
    JSON.parse(readFileSync(path.join(profile, "updates.json"))).automatic,
    false
  );
  assert.equal(
    JSON.parse(readFileSync(path.join(profile, "meeting-panel.json"))).opacity,
    0.75
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
