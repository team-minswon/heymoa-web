#!/usr/bin/env node
/**
 * `pnpm help:shots [이름…]` — 가이드의 정지 이미지를 만든다(APP-1236). 이름을 안 주면 전부.
 * 먼저 목 모드 dev 서버를 띄운다: `NEXT_PUBLIC_API_MOCKING=enabled pnpm dev --port 4200`.
 * 화면은 가이드 전용 목 프리셋으로만 찍는다(`common.mjs` 설명 참고).
 */
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

const url = (path) => `${BASE}${path}`;

/** 화면을 연 뒤 일회성 안내(내 에이전트 카드·시작하기 카드)를 치워 컷이 같은 모습이 되게 한다. */
async function open(page, path, { settle = 1200 } = {}) {
  // networkidle 은 오지 않는다 — 앱이 이벤트 스트림(`/v1/events`, APP-1335)을 늘 열어 둔다.
  // clips.mjs 처럼 DOM 이 서고 MSW 가 요청을 받기 시작한 뒤 잠깐 기다린다.
  await page.goto(url(path), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    navigator.serviceWorker.controller?.scriptURL.endsWith(
      "/mockServiceWorker.js"
    )
  );
  await page.evaluate(() => document.fonts.ready);
  await wait(settle);
  const nudge = page.getByRole("button", { name: "다시 보지 않기" });
  if (await nudge.count()) {
    await nudge.first().click();
    await wait(300);
  }
  const close = page.getByRole("button", { name: "시작하기 닫기" });
  if (await close.count()) {
    await close.first().click();
    await wait(300);
  }
  // 안내를 닫은 자리에 남은 포인터가 그 아래 줄을 hover 상태로 찍히게 하지 않는다
  await page.mouse.move(1, 1);
}

const dialog = (page) => page.getByRole("dialog");
/** 처음 열릴 때 첫 탭에 걸린 포커스 링을 지운다 */
const blurFocus = (page) =>
  page.evaluate(
    () =>
      document.activeElement instanceof HTMLElement &&
      document.activeElement.blur()
  );

const SHOTS = {
  // 새 회의 만들기 창 — 「만들기」에 링을 건다
  async "getting-started/new-meeting"({ page }) {
    await open(page, `/w/${IDS.workspace}`);
    await page.getByRole("button", { name: "새 노트" }).first().click();
    await dialog(page).waitFor();
    await wait(500);
    await ring(page, dialog(page).getByRole("button", { name: "만들기" }));
    await shoot(page, dialog(page), "getting-started/new-meeting", { pad: 28 });
  },

  // 사이드바 + 노트 목록(행에 올려 「⋯」가 보이는 모습)
  async "workspace-basics/note-list"({ page }) {
    await open(page, `/w/${IDS.workspace}`);
    const row = page.getByRole("link", { name: /노트 열기/ }).first();
    await row.hover();
    await wait(400);
    await shoot(
      page,
      { x: 0, y: 0, width: 1440, height: 720 },
      "workspace-basics/note-list"
    );
  },

  // 기록 중 도크 — 새 회의를 만들어 시작한 뒤 「일시정지」에 링
  async "recording/dock"({ page }) {
    // 도크가 위쪽 내용과 가깝게 보이도록 낮은 창으로 찍는다
    await page.setViewportSize({ width: 900, height: 520 });
    await open(page, `/w/${IDS.workspace}`);
    await page.getByRole("button", { name: "새 노트" }).first().click();
    await dialog(page).getByRole("button", { name: "만들기" }).click();
    await page.getByRole("button", { name: "회의 시작" }).click();
    await page
      .getByRole("button", { name: "일시정지" })
      .waitFor({ timeout: 15000 });
    // 목 전사가 첫 줄을 낼 때까지(가짜 마이크가 소리를 내면 목이 발화로 읽는다)
    await page
      .getByText("첫 발화를 기다리고 있습니다")
      .waitFor({ state: "detached", timeout: 40000 });
    await wait(13000);
    // ⏸ 에 올려 툴팁(「일시정지 — 회의는 끝나지 않습니다」)까지 보이게 한다
    const pause = page.getByRole("button", { name: "일시정지", exact: true });
    await pause.hover();
    await page.getByText("회의는 끝나지 않습니다").waitFor();
    await ring(page, pause);
    await shoot(
      page,
      { x: 0, y: 0, width: 900, height: 520 },
      "recording/dock"
    );
  },

  // 종료한 회의에서 화자 이름 칩을 눌러 연 지정 메뉴
  async "speakers/assign-menu"({ page }) {
    await open(
      page,
      `/w/${IDS.workspace}/notes/${IDS.endedDiarized}?view=full&tab=transcript`
    );
    // 아직 이름을 안 붙인 화자의 칩(placeholder)을 눌러 지정 메뉴를 연다
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

  // 정보 탭의 회의 맥락
  async "terms-context/context"({ page }) {
    await open(
      page,
      `/w/${IDS.workspace}/notes/${IDS.details}?view=full&tab=details`
    );
    const section = page
      .getByRole("heading", { name: "회의 맥락" })
      .locator("xpath=ancestor::section[1]");
    await section.scrollIntoViewIfNeeded();
    await wait(400);
    await shoot(page, section, "terms-context/context", { pad: 24 });
  },

  // 요약 검토 화면 — 항목 하나를 펼친 모습
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

  // 할 일 표
  async "tasks/table"({ page }) {
    await open(page, `/w/${IDS.workspace}/tasks`);
    await wait(800);
    await shoot(page, { x: 0, y: 0, width: 1440, height: 900 }, "tasks/table");
  },

  // 설정 › 멤버 › 이름 변경
  async "members/rename"({ page }) {
    await open(page, `/w/${IDS.workspace}?settings=members`);
    // 멤버 행의 「⋯」(aria 「이름(이메일) 관리」) — 설정 탭 「MCP 연결」와 헷갈리지 않게 이메일이 든 것만
    // 내가 아닌 멤버(두 번째 줄)의 이름을 바꾸는 장면으로 찍는다
    await dialog(page)
      .getByRole("button", { name: /@.*\) 관리$/ })
      .nth(1)
      .click();
    await page.getByRole("menuitem", { name: "이름 변경" }).click();
    await page.getByText("이 워크스페이스에서 보일 이름").waitFor();
    await wait(500);
    await shoot(
      page,
      page.locator('[data-slot="dialog-content"]').last(),
      "members/rename",
      { pad: 20 }
    );
  },

  // 설정 › 연동
  async "integrations/settings"({ page }) {
    await open(page, `/w/${IDS.workspace}?settings=integrations`);
    await wait(800);
    await blurFocus(page);
    await shoot(page, dialog(page), "integrations/settings", { pad: 16 });
  },

  // 문의·피드백
  async "feedback/dialog"({ page }) {
    await open(page, `/w/${IDS.workspace}`);
    await page.getByRole("button", { name: /문의·피드백/ }).click();
    await dialog(page).waitFor();
    await wait(500);
    await shoot(page, dialog(page), "feedback/dialog", { pad: 28 });
  },

  // 내 에이전트 패널
  async "agent/chat"({ page }) {
    await open(page, `/w/${IDS.workspace}/tasks`);
    await page.getByRole("button", { name: "내 에이전트 열기" }).click();
    await wait(1200);
    await shoot(page, { x: 0, y: 0, width: 1440, height: 900 }, "agent/chat");
  },

  // 설정 › 내 MCP 연결 › 새 연결
  async "agent-mcp/new-connection"({ page }) {
    await open(page, `/w/${IDS.workspace}?settings=agents`);
    await page.getByRole("button", { name: "새 연결" }).click();
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
  // 가짜 마이크 전사처럼 타이밍에 기대는 컷이 가끔 늦는다 — 새 컨텍스트로 최대 3번 다시 찍는다
  for (let attempt = 1; ; attempt += 1) {
    // 가이드는 데스크톱 1440 폭 화면을 기준으로 찍는다(APP-1411). 도크처럼 좁게 찍을 컷만 컷 안에서 줄인다.
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
