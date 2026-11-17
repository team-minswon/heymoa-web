import { expect, test, type Page } from "@playwright/test";
import { settled } from "./helpers-ui";

const MOCK_WORKSPACE_ID = "01K0000000000";

async function openPanel(page: Page) {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();
  const panel = page.getByTestId("personal-chat-panel");
  await expect(panel).toBeVisible();
  return settled(panel);
}

async function openChat(page: Page, title: RegExp) {
  await page.getByRole("button", { name: "대화 기록" }).click();
  await page
    .getByTestId("chat-history-view")
    .getByRole("button", { name: title })
    .click();
}

for (const width of [1440, 1024]) {
  test.describe(`${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
    });

    test("머리글은 화면마다 하나이고 높이·첫 버튼 자리가 대화↔기록에서 그대로다", async ({
      page,
    }) => {
      const panel = await openPanel(page);
      expect(Math.round((await panel.boundingBox())!.width)).toBe(448);
      const header = panel.locator("header");
      const history = page.getByRole("button", { name: "대화 기록" });
      const before = (await history.boundingBox())!;
      const headerHeight = (await header.boundingBox())!.height;
      expect(Math.round(before.width)).toBe(34);
      expect(Math.round(before.height)).toBe(34);

      await history.click();
      const back = page.getByRole("button", { name: "대화로 돌아가기" });
      await expect(back).toBeVisible();
      const after = (await back.boundingBox())!;
      expect(Math.round(after.x)).toBe(Math.round(before.x));
      expect(Math.round(after.y)).toBe(Math.round(before.y));
      expect((await header.boundingBox())!.height).toBe(headerHeight);
      await expect(header).toContainText("대화 기록");
      await expect(
        page
          .getByTestId("chat-history-view")
          .getByRole("button", { name: /뒤로/ })
      ).toHaveCount(0);
      await expect(page.getByTestId("chat-group")).toHaveText([
        "오늘",
        "어제",
        "지난 7일",
        "이전",
      ]);

      await page.keyboard.press("Escape");
      await expect(page.getByTestId("chat-history-view")).toBeHidden();
    });

    test("스크롤바는 가리키거나 스크롤할 때만 보이고, 열자마자 가로로 넘치지 않는다", async ({
      page,
    }) => {
      const panel = await openPanel(page);
      const scrollbar = panel
        .getByTestId("chat-thread-view")
        .locator('[data-slot="scroll-area-scrollbar"]')
        .first();
      if ((await scrollbar.count()) > 0) {
        await page.mouse.move(10, 10);
        await expect
          .poll(() => scrollbar.evaluate((el) => getComputedStyle(el).opacity))
          .toBe("0");
      }
      const overflow = await panel.evaluate(
        (el) => el.scrollWidth - el.clientWidth
      );
      expect(overflow).toBe(0);
    });

    test("보낸 질문의 턴이 스크롤 맨 위에 서고(구분선 포함), 위로 올리면 「맨 아래로」가 가로 가운데에 선다", async ({
      page,
    }) => {
      const panel = await openPanel(page);
      await openChat(page, /^배포 일정 확인(?! 메뉴)/);
      await page.getByLabel("메시지").fill("배포 일정 정리해줘");
      await page.getByRole("button", { name: "보내기", exact: true }).click();

      const thread = panel.getByTestId("chat-thread-view");
      const viewport = thread.locator('[data-slot="scroll-area-viewport"]');
      const pinned = thread.getByTestId("chat-pinned-turn");
      const divider = pinned.getByTestId("thread-divider");
      await expect(divider).toBeVisible();
      await expect
        .poll(async () => {
          const top = (await viewport.boundingBox())!.y;
          return [
            Math.round((await pinned.boundingBox())!.y - top) + 0,
            Math.round((await divider.boundingBox())!.y - top) + 0,
          ];
        })
        .toEqual([0, 24]);

      await viewport.evaluate((el) => (el.scrollTop = 0));
      const toBottom = thread.getByRole("button", { name: "맨 아래로" });
      await expect(toBottom).toBeVisible();
      const button = (await toBottom.boundingBox())!;
      const box = (await viewport.boundingBox())!;
      expect(
        Math.abs(button.x + button.width / 2 - (box.x + box.width / 2))
      ).toBeLessThan(2);
    });
  });
}

const width = 1440;
test.describe("대화 동작", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
  });

  test("끝난 진행은 「N초 동안 생각 · 회의록 1건」 한 줄로 접히고, 펴면 줄마다 한 단계다", async ({
    page,
  }) => {
    await openPanel(page);
    await openChat(page, /^주간 제품 회의 진행 순서(?! 메뉴)/);
    const thread = page.getByTestId("chat-thread-view");
    const head = thread.getByRole("button", {
      name: /초 동안 생각 · 회의록 1건/,
    });
    await expect(head).toHaveAttribute("aria-expanded", "false");
    await expect(head).not.toContainText("단계");
    await head.click();
    await expect(thread.locator('[data-step="thinking"]')).toHaveText([
      "주간 제품 회의가 진행된 순서를 찾아볼게요.",
      "안건 요약에서 진행 순서를 확인할게요.",
      "스크립트에서 각 안건이 나온 시각을 확인할게요.",
    ]);
    await expect(
      thread.getByTestId("assistant-message").last()
    ).not.toContainText("찾아볼게요");
    const actions = thread.getByTestId("message-actions").last();
    await expect(actions).toHaveCSS("opacity", "1");

    const refs = thread
      .getByRole("group", { name: "참고한 회의록 1개" })
      .last();
    await refs.getByRole("button", { name: /주간 제품 회의/ }).click();
    await expect(page).toHaveURL(/\/notes\/01K0000000002/);
  });

  test("옛 대화는 진행 문장이 본문에 섞인 그대로 그린다", async ({ page }) => {
    await openPanel(page);
    await openChat(page, /^알림 정책 결정 사항(?! 메뉴)/);
    const answer = page
      .getByTestId("chat-thread-view")
      .getByTestId("assistant-message")
      .last();
    await expect(answer).toContainText(
      "회의록에서 알림 정책 얘기를 찾아볼게요."
    );
    await expect(answer).toContainText("기본값을 끄고");
  });

  test("보내면 「생각 중 · N초」와 진행 줄이 서고, 끝나면 접히고 AI 제목이 머리글에 늦게 붙는다", async ({
    page,
  }) => {
    const panel = await openPanel(page);
    await page.getByTestId("chat-list-new").click();
    await expect(panel.locator("header")).toContainText("새 대화");
    await page.getByLabel("메시지").fill("배포 일정 정리해줘");
    await page.getByRole("button", { name: "보내기", exact: true }).click();

    const thread = page.getByTestId("chat-thread-view");
    await expect(thread.getByText("생각 중", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      thread.locator("[data-current], [data-tail]").first()
    ).toBeVisible();
    const tail = thread.locator("[data-tail]").first();
    await expect(tail).toBeVisible({ timeout: 10_000 });
    const maxHeight = await tail.evaluate((el) =>
      parseFloat(getComputedStyle(el).maxHeight)
    );
    expect(maxHeight).toBeCloseTo(96, 0);
    await expect(
      page.getByRole("button", { name: "중지", exact: true })
    ).toBeVisible();

    await expect(
      thread.getByRole("button", { name: /초 동안 생각/ }).last()
    ).toBeVisible({ timeout: 30_000 });
    await expect(panel.locator("header")).toContainText("배포 일정 정리", {
      timeout: 10_000,
    });
    await expect(
      page.getByRole("button", { name: "보내기", exact: true })
    ).toBeVisible();
  });

  test("@ 를 치면 목록이 열리고, 고르면 범위 칩이 문장 안에 제목 전체로 박힌다 — 오른쪽에는 보내기만 선다", async ({
    page,
  }) => {
    await openPanel(page);
    await page.getByTestId("chat-list-new").click();
    const composer = page.getByTestId("chat-thread-view").locator("form");
    const input = page.getByLabel("메시지");
    await expect(
      page.getByRole("button", { name: "회의록·프로젝트 고르기" })
    ).toHaveCount(0);
    await expect(page.getByTestId("composer-chips")).toHaveCount(0);
    await expect(composer.getByRole("button")).toHaveCount(1);
    const inputBox = (await input.boundingBox())!;
    const sendBox = (await page
      .getByRole("button", { name: "보내기", exact: true })
      .boundingBox())!;
    expect(sendBox.x).toBeGreaterThan(inputBox.x + inputBox.width - 1);

    await input.click();
    await page.keyboard.type("@");
    const picker = page.getByTestId("scope-picker");
    await expect(picker).toBeVisible();
    expect((await picker.boundingBox())!.height).toBeLessThanOrEqual(300);
    await expect(picker).toContainText("↑↓ 이동");
    await page.keyboard.type("주간 제품");
    await picker
      .getByRole("option")
      .filter({ hasText: "주간 제품 회의" })
      .first()
      .click();
    const chip = input.locator("[data-scope-chip]");
    await expect(chip).toHaveText(["주간 제품 회의"]);
    await expect(input).not.toContainText("@");
    await page.keyboard.type("결정만 정리해줘");
    await expect(input).toHaveText(/주간 제품 회의\s결정만 정리해줘/);
  });

  test("빈 입력창에 포커스하면 캐럿이 플레이스홀더 첫 글자 자리에 선다", async ({
    page,
  }) => {
    await openPanel(page);
    await page.getByTestId("chat-list-new").click();
    const input = page.getByLabel("메시지");
    await input.click({ position: { x: 300, y: 10 } });
    const caret = await page.evaluate(() => {
      const range = window.getSelection()!.getRangeAt(0).cloneRange();
      const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
      const box = document
        .querySelector('[aria-label="메시지"]')!
        .getBoundingClientRect();
      return rect.x - box.x;
    });
    expect(caret).toBeLessThan(4);
  });

  test("긴 URL·영문 토큰 답에도 패널이 가로로 넘치지 않는다", async ({
    page,
  }) => {
    const panel = await openPanel(page);
    await page.getByTestId("chat-list-new").click();
    await page.getByLabel("메시지").fill("마크다운 보여줘");
    await page.getByRole("button", { name: "보내기", exact: true }).click();
    await expect(page.getByTestId("assistant-message").last()).toContainText(
      "analytics.example.com",
      { timeout: 30_000 }
    );
    const overflow = await panel.evaluate((el) => {
      const viewport = el.querySelector(
        '[data-testid="chat-thread-view"] [data-slot="scroll-area-viewport"]'
      )!;
      return [
        el.scrollWidth - el.clientWidth,
        viewport.scrollWidth - viewport.clientWidth,
      ];
    });
    expect(overflow).toEqual([0, 0]);
  });

  test("참고 회의록 칩을 누르면 그 회의록의 스크립트가 열리고 대화는 옆 레일에 남는다", async ({
    page,
  }) => {
    await openPanel(page);
    await openChat(page, /^주간 제품 회의 진행 순서(?! 메뉴)/);
    await page
      .getByRole("group", { name: "참고한 회의록 1개" })
      .last()
      .getByRole("button", { name: /주간 제품 회의/ })
      .click();
    await expect(page).toHaveURL(
      /notes\/01K0000000002\?view=full&tab=transcript/
    );
    if (width >= 1280) {
      const rail = page.getByTestId("note-agent-rail");
      await expect(rail.getByTestId("personal-chat-panel")).toBeVisible();
      await expect(rail.getByTestId("assistant-message").last()).toContainText(
        "흐름이었어요"
      );
    }
  });

  test("레일에서도 머리글은 한 줄이다 — 기록·제목·⋯·+·접기", async ({
    page,
  }) => {
    await page.goto(
      `/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full&tab=transcript`
    );
    const rail = page.getByTestId("note-agent-rail");
    await expect(rail.getByTestId("personal-chat-panel")).toBeVisible();
    await expect(rail).not.toContainText("나만 보는 대화");
    const header = rail.locator("header");
    const headerBox = (await header.boundingBox())!;
    const collapse = (await rail
      .getByRole("button", { name: "내 에이전트 접기" })
      .boundingBox())!;
    expect(collapse.y).toBeGreaterThanOrEqual(headerBox.y);
    expect(collapse.y + collapse.height).toBeLessThanOrEqual(
      headerBox.y + headerBox.height
    );
    const plus = (await rail.getByTestId("chat-list-new").boundingBox())!;
    expect(collapse.x).toBeGreaterThan(plus.x);
    expect(Math.abs(collapse.y - plus.y)).toBeLessThan(2);
  });
});

test("390px 에서는 화면 전체를 덮는 시트다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = await openPanel(page);
  const box = (await panel.boundingBox())!;
  expect(Math.round(box.x)).toBe(0);
  expect(Math.round(box.width)).toBe(390);
  expect(Math.round(box.height)).toBe(844);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("390px 에서도 긴 URL·영문 토큰 답이 가로로 넘치지 않는다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = await openPanel(page);
  await page.getByTestId("chat-list-new").click();
  const input = page.getByLabel("메시지");
  await expect(input).toHaveAttribute(
    "data-placeholder",
    "@로 프로젝트나 회의록을 붙여 물어보세요"
  );
  await input.fill("마크다운 보여줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "analytics.example.com",
    { timeout: 30_000 }
  );
  const overflow = await panel.evaluate((el) => {
    const viewport = el.querySelector(
      '[data-testid="chat-thread-view"] [data-slot="scroll-area-viewport"]'
    )!;
    return [
      el.scrollWidth - el.clientWidth,
      viewport.scrollWidth - viewport.clientWidth,
    ];
  });
  expect(overflow).toEqual([0, 0]);
});
