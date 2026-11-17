#!/usr/bin/env node
import { BASE, chromium, openDemo, shoot, wait } from "./common.mjs";
import { K, L } from "./ui.mjs";

const WS = "01K0000000000";
const PROJECT = "0PGP000000001";
const MAP = `${BASE}/w/${WS}/projects/${PROJECT}`;
const wanted = process.argv.slice(2);

async function open(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith("/mockServiceWorker.js"));
  await page.evaluate(() => document.fonts.ready);
  await wait(2500);
  for (const name of [L("다시 보지 않기"), L("시작하기 닫기")]) {
    const button = page.getByRole("button", { name });
    if (await button.count()) {
      await button.first().click();
      await wait(300);
    }
  }
  await page.mouse.move(1, 1);
}

async function openMap(page) {
  await open(page, MAP);
  await page.keyboard.press("Control+b");
  await wait(900);
  await page.mouse.move(700, 600);
  await page.mouse.down();
  await page.mouse.move(625, 600, { steps: 12 });
  await page.mouse.up();
  await wait(600);
}

const clip = (height) => ({ x: 0, y: 0, width: 1440, height });
const SCENES = {
  async entry(page) {
    await open(page, `${BASE}/w/${WS}`);
    await page.getByText(L("앱 출시 준비", "App Launch Prep"), { exact: true }).first().click();
    await wait(1500);
    await page.mouse.move(1, 1);
    await shoot(page, clip(560), "agenda-map/entry", { maxWidth: 1100, budget: 70 * 1024 });
  },
  async overview(page) {
    await openMap(page);
    await page.mouse.move(1, 1);
    await wait(400);
    await shoot(page, clip(1040), "agenda-map/overview", { budget: 80 * 1024 });
  },
  async expand(page) {
    await openMap(page);
    await page.locator("button[data-head]", { hasText: L("고객 인터뷰 정리", "Customer interview debrief") }).first().click();
    await wait(1200);
    await wait(400);
    await shoot(page, clip(1040), "agenda-map/expand", { budget: 90 * 1024 });
  },
  async panel(page) {
    await openMap(page);
    await page.getByRole("button", { name: new RegExp(`${L("요금제 경쟁사 비교", "Competitor pricing comparison")}$`) }).first().click();
    await wait(1200);
    await page.mouse.move(600, 160);
    await wait(900);
    await shoot(page, clip(1040), "agenda-map/panel", { budget: 90 * 1024 });
  },
  async focus(page) {
    await openMap(page);
    await page.getByRole("button", { name: new RegExp(`^${L("베타 피드백 반영 목록", "Beta feedback fix list")} · ${K("workspace.agendaMap.focusTopicHint")}`) }).click();
    await wait(1800);
    await page.mouse.move(1, 1);
    await wait(300);
    await shoot(page, clip(720), "agenda-map/focus", { budget: 90 * 1024 });
  },
};

const browser = await chromium.launch();
for (const [name, scene] of Object.entries(SCENES)) {
  if (wanted.length && !wanted.includes(name)) continue;
  console.log(`shot ${name}`);
  const { context, page } = await openDemo(browser, { width: 1440, height: 1040, scale: 2 });
  await context.route("**/mock-local/projects.json", (route) => route.fulfill({ status: 404, body: "" }));
  try {
    await scene(page);
  } finally {
    await context.close();
  }
}
await browser.close();
