import assert from "node:assert/strict";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installCursor } from "./cursor.mjs";
import { scenes } from "./scenes.mjs";
import { desktopScene } from "./desktop-scene.mjs";
import { encode } from "./encode.mjs";
import { languageCookies, OUT, record } from "./common.mjs";
import { BROWSER_LOCALE, LOCALE } from "./ui.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
process.chdir(root);
const work = path.join(root, "scripts/help-media/.work");
await mkdir(work, { recursive: true });
process.env.TMPDIR = work;
const { chromium } =
  await import("../../node_modules/@playwright/test/index.mjs");
const base = (process.env.HELP_BASE || "http://localhost:4200").replace(
  /\/+$/,
  ""
);
const origin = new URL(base);
assert.ok(["http:", "https:"].includes(origin.protocol));
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname),
  "HELP_BASE는 로컬 목 서버만 허용합니다."
);
assert.ok(
  !origin.username &&
    !origin.password &&
    origin.pathname === "/" &&
    !origin.search &&
    !origin.hash
);
const port = Number(origin.port || 80);
assert.ok(
  port < 3100 || port > 4100 || port === 3601,
  "3100~4100의 다른 서버는 사용하지 않습니다."
);
const requested = process.argv.slice(2);
const names = [...scenes.map((s) => s.name), ...(LOCALE === "en" ? [] : ["desktop-menubar"])];
for (const name of requested)
  assert.ok(names.includes(name), `알 수 없는 클립: ${name}`);
const selected = requested.length
  ? names.filter((n) => requested.includes(n))
  : names;
if (selected.some((n) => n !== "desktop-menubar")) {
  try {
    const response = await fetch(`${base}/w/01K0000000000`, {
      signal: AbortSignal.timeout(15000),
      redirect: "manual",
    });
    assert.ok(response.status < 400, `HTTP ${response.status}`);
  } catch (error) {
    throw new Error(
      `목 서버를 먼저 시작해 주세요: NEXT_PUBLIC_API_MOCKING=enabled pnpm dev --port 3601 (${error.message})`
    );
  }
}
let browser;
const report = {};
try {
  browser = await chromium.launch({
    headless: true,
    downloadsPath: work,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  for (const name of selected) {
    console.log(`녹화: ${name}`);
    const vp =
      name === "desktop-menubar"
        ? { width: 760, height: 640 }
        : (scenes.find((s) => s.name === name)?.viewport ?? {
            width: 1280,
            height: 720,
          });
    const context = await browser.newContext({
      viewport: vp,
      recordVideo: { dir: work, size: vp },
      locale: BROWSER_LOCALE,
      timezoneId: "Asia/Seoul",
      colorScheme: "light",
      permissions: ["microphone"],
      serviceWorkers: "allow",
    });
    try {
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        return url.origin === origin.origin ||
          ["data:", "blob:"].includes(url.protocol)
          ? route.continue()
          : route.abort();
      });
      await context.addCookies([
        { name: "heymoa-help-demo", value: "1", url: base },
        ...languageCookies(base),
      ]);
      const endNudge = Boolean(
        scenes.find((s) => s.name === name)?.endNudge
      );
      await context.addInitScript((endNudge) => {
        localStorage.setItem("heymoa:helpDemo", "1");
        localStorage.setItem("heymoa:analytics-opt-out", "1");
        localStorage.setItem("heymoa:u:user-12345:agent-intro-dismissed", "1");
        if (!endNudge)
          localStorage.setItem("heymoa:u:user-12345:end-nudge-off", "1");
        localStorage.setItem(
          "heymoa:onboarding:user-12345",
          JSON.stringify({ status: "dismissed", done: [] })
        );
        const NativeDate = Date;
        const epoch = NativeDate.now();
        const fixed = NativeDate.parse("2026-04-30T05:00:00+09:00");
        window.Date = class extends NativeDate {
          constructor(...args) {
            super(...(args.length ? args : [fixed + NativeDate.now() - epoch]));
          }
          static now() {
            return fixed + NativeDate.now() - epoch;
          }
        };
      }, endNudge);
      await context.addInitScript(installCursor);
      const scene =
        name === "desktop-menubar"
          ? await desktopScene(context, base)
          : scenes.find((s) => s.name === name);
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      const videoZero = performance.now();
      const video = page.video();
      await page.goto(`${base}${scene.path}`, {
        waitUntil: "domcontentloaded",
      });
      if (name !== "desktop-menubar") {
        await page.waitForFunction(() =>
          navigator.serviceWorker.controller?.scriptURL.endsWith(
            "/mockServiceWorker.js"
          )
        );
      }
      await scene.ready(page);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1000);
      await page.mouse.move(vp.width - 180, vp.height - 60, { steps: 24 });
      const start = (performance.now() - videoZero) / 1000;
      await page.waitForTimeout(650);
      let posterAt = 0;
      await scene.run(page, () => {
        posterAt = (performance.now() - videoZero) / 1000 - start;
      });
      await page.waitForTimeout(scene.endHold ?? 1000);
      const duration = (performance.now() - videoZero) / 1000 - start;
      await context.close();
      const raw = await video.path();
      report[name] = await encode(
        raw,
        path.join(work, name),
        start,
        Math.max(5, duration),
        path.join(work, "qa", name),
        vp.width === 1280 || scene.viewport
          ? { width: 960, height: 540 }
          : vp,
        { posterAt, fade: scene.fade }
      );
      console.log(`${name}: ${JSON.stringify(report[name])}`);
    } finally {
      await context.close();
    }
  }
  await mkdir(path.join(OUT, "clips"), { recursive: true });
  for (const [name, result] of Object.entries(report)) {
    for (const ext of ["webm", "mp4", "webp"])
      await copyFile(
        path.join(work, `${name}.${ext}`),
        path.join(OUT, "clips", `${name}.${ext}`)
      );
    record(`clips/${name}`, {
      width: result.width,
      height: result.height,
      bytes: result.webm + result.mp4 + result.poster,
    });
  }
  await writeFile(
    path.join(work, "report.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
  console.log(
    "완료. 프레임 확인: scripts/help-media/.work/qa/<name>/contact.png"
  );
} finally {
  await browser?.close();
}
