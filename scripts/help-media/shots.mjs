#!/usr/bin/env node
import {
  BASE,
  chromium,
  clearRings,
  openDemo,
  ring,
  shoot,
  wait,
} from "./common.mjs";
import { IDS } from "./ids.mjs";
import { K, L, R } from "./ui.mjs";

const url = (path) => `${BASE}${path}`;

async function open(page, path, { settle = 1200 } = {}) {
  await page.goto(url(path), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    navigator.serviceWorker.controller?.scriptURL.endsWith(
      "/mockServiceWorker.js"
    )
  );
  await page.evaluate(() => document.fonts.ready);
  await wait(settle);
  const nudge = page.getByRole("button", { name: L("다시 보지 않기") });
  if (await nudge.count()) {
    await nudge.first().click();
    await wait(300);
  }
  const close = page.getByRole("button", { name: L("시작하기 닫기") });
  if (await close.count()) {
    await close.first().click();
    await wait(300);
  }
  await page.mouse.move(1, 1);
}

const dialog = (page) => page.getByRole("dialog");
const blurFocus = (page) =>
  page.evaluate(
    () =>
      document.activeElement instanceof HTMLElement &&
      document.activeElement.blur()
  );

const SHOTS = {
  async "getting-started/new-meeting"({ page }) {
    await open(page, `/w/${IDS.workspace}`);
    await page.getByRole("button", { name: L("새 노트") }).first().click();
    await dialog(page).waitFor();
    await wait(500);
    await ring(page, dialog(page).getByRole("button", { name: L("만들기") }));
    await shoot(page, dialog(page), "getting-started/new-meeting", { pad: 28 });
  },

  async "workspace-basics/note-list"({ page }) {
    await open(page, `/w/${IDS.workspace}`);
    const row = page.getByRole("link", { name: R(/노트 열기/, /^Open note/) }).first();
    await row.hover();
    await wait(400);
    await shoot(
      page,
      { x: 0, y: 0, width: 1440, height: 720 },
      "workspace-basics/note-list"
    );
  },

  async "recording/dock"({ page }) {
    await page.setViewportSize({ width: 900, height: 520 });
    await open(page, `/w/${IDS.workspace}`);
    await page.getByRole("button", { name: L("새 노트") }).first().click();
    await dialog(page).getByRole("button", { name: L("만들기") }).click();
    await page.getByRole("button", { name: L("회의 시작") }).click();
    await page
      .getByRole("button", { name: K("recording.dock.pause") })
      .waitFor({ timeout: 15000 });
    await page
      .getByText(L("첫 발화를 기다리고 있습니다"))
      .waitFor({ state: "detached", timeout: 40000 });
    await wait(13000);
    const pause = page.getByRole("button", { name: K("recording.dock.pause"), exact: true });
    await pause.hover();
    await page.getByText(K("recording.pause.tooltip")).waitFor();
    await ring(page, pause);
    await shoot(
      page,
      { x: 0, y: 0, width: 900, height: 520 },
      "recording/dock"
    );
  },

  async "speakers/assign-menu"({ page }) {
    await open(
      page,
      `/w/${IDS.workspace}/notes/${IDS.endedDiarized}?view=full&tab=transcript`
    );
    await page
      .locator('[data-testid="speaker-assign-trigger"][data-placeholder]')
      .first()
      .click();
    await wait(700);
    await shoot(
      page,
      { x: 0, y: 0, width: 1440, height: 810 },
      "speakers/assign-menu"
    );
  },

  async "terms-context/context"({ page }) {
    await open(
      page,
      `/w/${IDS.workspace}/notes/${IDS.details}?view=full&tab=details`
    );
    const section = page
      .getByRole("heading", { name: L("회의 맥락") })
      .locator("xpath=ancestor::section[1]");
    await section.scrollIntoViewIfNeeded();
    await wait(400);
    await shoot(page, section, "terms-context/context", { pad: 24 });
  },

  async "review/proposals"({ page }) {
    await open(
      page,
      `/w/${IDS.workspace}/notes/${IDS.reviewing}?view=full&tab=summary`
    );
    await wait(1500);
    await blurFocus(page);
    await shoot(
      page,
      { x: 0, y: 0, width: 1440, height: 900 },
      "review/proposals"
    );
  },

  async "tasks/table"({ page }) {
    await open(page, `/w/${IDS.workspace}/tasks`);
    await wait(800);
    await shoot(page, { x: 0, y: 0, width: 1440, height: 900 }, "tasks/table");
  },

  async "members/rename"({ page }) {
    await open(page, `/w/${IDS.workspace}?settings=members`);
    await dialog(page)
      .getByRole("button", { name: R(/@.*\) 관리$/, /^Manage .*@.*\)$/) })
      .nth(1)
      .click();
    await page.getByRole("menuitem", { name: L("이름 변경") }).click();
    await page.getByText(L("이 워크스페이스에서 보일 이름")).waitFor();
    await wait(500);
    await shoot(
      page,
      page.locator('[data-slot="dialog-content"]').last(),
      "members/rename",
      { pad: 20 }
    );
  },

  async "integrations/settings"({ page }) {
    await open(page, `/w/${IDS.workspace}?settings=integrations`);
    await wait(800);
    await blurFocus(page);
    await shoot(page, dialog(page), "integrations/settings", { pad: 16 });
  },

  async "feedback/dialog"({ page }) {
    await open(page, `/w/${IDS.workspace}`);
    await page.getByRole("button", { name: new RegExp(L("문의·피드백")) }).click();
    await dialog(page).waitFor();
    await wait(500);
    await shoot(page, dialog(page), "feedback/dialog", { pad: 28 });
  },

  async "agent/chat"({ page }) {
    await open(page, `/w/${IDS.workspace}/tasks`);
    await page.getByRole("button", { name: L("내 에이전트 열기") }).click();
    await wait(1200);
    await shoot(page, { x: 0, y: 0, width: 1440, height: 900 }, "agent/chat");
  },

  async "agent-mcp/new-connection"({ page }) {
    await open(page, `/w/${IDS.workspace}?settings=agents`);
    await page.getByRole("button", { name: L("새 연결") }).click();
    await wait(800);
    await blurFocus(page);
    await shoot(page, dialog(page).last(), "agent-mcp/new-connection", {
      pad: 16,
    });
  },
};

const wanted = process.argv.slice(2);
const browser = await chromium.launch({
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
for (const [name, shot] of Object.entries(SHOTS)) {
  if (wanted.length && !wanted.includes(name)) continue;
  console.log(`shot ${name}`);
  for (let attempt = 1; ; attempt += 1) {
    const { context, page } = await openDemo(browser, {
      width: 1440,
      height: 900,
      scale: 2,
    });
    try {
      await shot({ page });
      break;
    } catch (error) {
      if (attempt >= 3) throw error;
      console.log(
        `  다시 시도 (${attempt}): ${String(error.message).split("\n")[0]}`
      );
    } finally {
      await clearRings(page).catch(() => undefined);
      await context.close();
    }
  }
}
await browser.close();
