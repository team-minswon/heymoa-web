const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

test("real first-run screen reads without prompting, supports denial/recheck/skip and keyboard errors", async (t) => {
  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 720, height: 700 }, reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.requests = [];
    window.permissionView = { platform: "darwin", microphone: "not-determined" };
    window.heymoaOnboarding = { action: async (action) => { window.requests.push(action); if (action === "complete") throw new Error("save failed"); return window.permissionView; } };
  });
  await page.goto(pathToFileURL(path.resolve(__dirname, "../dist/onboarding.html")).href);
  await page.waitForFunction(() => document.querySelector("#microphone-status").textContent === "아직 확인하지 않음");
  assert.ok((await page.evaluate(() => window.requests)).every((value) => value === "read"));
  assert.equal(await page.locator("#microphone-action").textContent(), "마이크 허용");
  await page.evaluate(() => { window.permissionView.microphone = "denied"; });
  await page.locator("#microphone-action").click();
  await page.waitForFunction(() => document.querySelector("#microphone-action").textContent === "설정 열기");
  assert.equal(await page.locator("#complete").textContent(), "나중에 설정하고 시작하기");
  await page.evaluate(() => { window.permissionView.microphone = "granted"; });
  await page.locator("#recheck").click();
  await page.waitForFunction(() => document.querySelector("#microphone-action").disabled);
  assert.equal(await page.locator("#complete").textContent(), "HeyMoa 시작하기");
  await page.evaluate(() => { window.permissionView = { platform: "win32", microphone: "unknown" }; });
  await page.locator("#recheck").click();
  await page.waitForFunction(() => document.querySelector("#microphone-status").textContent === "설정에서 확인");
  assert.match(await page.locator("#audio-description").textContent(), /Windows 출력 장치/);
  await page.locator("#complete").focus(); await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#error").textContent.includes("저장하지 못했습니다"));
  assert.equal(await page.locator("#complete").isEnabled(), true);
  const geometry = await page.locator("footer").evaluate((node) => ({ bottom: node.getBoundingClientRect().bottom, viewport: innerHeight, width: document.documentElement.scrollWidth }));
  assert.ok(geometry.bottom <= geometry.viewport); assert.equal(geometry.width, 720);
});
