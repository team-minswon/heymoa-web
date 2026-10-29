#!/usr/bin/env node
/**
 * `pnpm help:agenda-map [entry|overview|expand|panel|focus]` — 가이드 「안건 연결 지도」 글의 이미지 5장(APP-1455).
 * 목 모드 dev 서버를 연 채: `HELP_BASE=http://localhost:3068 pnpm help:agenda-map` (이름을 안 주면 다섯 다).
 * 가이드 목 프리셋(`heymoa:helpDemo=1`, `openDemo` 가 켠다)이 프로젝트 「앱 출시 준비」(`lib/mocks/guide-agenda-map.ts`)를 낸다.
 * 출력: public/help/agenda-map/{entry,overview,expand,panel,focus}.webp (+ lib/help/media-manifest.ts). 화면이 바뀌면 이 명령 한 줄로 다시 찍는다.
 */
import { BASE, chromium, openDemo, shoot, wait } from "./common.mjs";

const WS = "01K0000000000";
const PROJECT = "0PGP000000001";
const MAP = `${BASE}/w/${WS}/projects/${PROJECT}`;
const wanted = process.argv.slice(2);

async function open(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith("/mockServiceWorker.js"));
  await page.evaluate(() => document.fonts.ready);
  await wait(2500);
  for (const name of ["다시 보지 않기", "시작하기 닫기"]) {
    const button = page.getByRole("button", { name });
    if (await button.count()) {
      await button.first().click();
      await wait(300);
    }
  }
  await page.mouse.move(1, 1);
}

/** 지도를 열고 사이드바를 접은 뒤 판을 살짝 밀어 첫·마지막 회의 열이 다 보이게 한다 */
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
    await page.getByText("앱 출시 준비", { exact: true }).first().click();
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
    await page.locator("button[data-head]", { hasText: "고객 인터뷰 정리" }).first().click();
    await wait(1200);
    await wait(400);
    await shoot(page, clip(1040), "agenda-map/expand", { budget: 90 * 1024 });
  },
  async panel(page) {
    await openMap(page);
    await page.getByRole("button", { name: "09.24 요금제 경쟁사 비교", exact: true }).click();
    await wait(1200);
    await page.mouse.move(600, 160);
    await wait(900);
    await shoot(page, clip(1040), "agenda-map/panel", { budget: 90 * 1024 });
  },
  async focus(page) {
    await openMap(page);
    await page.getByRole("button", { name: /^베타 피드백 반영 목록 · 눌러서 이 줄기만 크게 보기/ }).click();
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
  // 개발자 로컬 시드(public/mock-local, 실제 팀 데이터일 수 있다)는 가이드 화면에 절대 나오면 안 된다 — 없는 것으로 만든다
  await context.route("**/mock-local/projects.json", (route) => route.fulfill({ status: 404, body: "" }));
  try {
    await scene(page);
  } finally {
    await context.close();
  }
}
await browser.close();
