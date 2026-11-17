import { expect, test, type Page } from "@playwright/test";

const WORKSPACE_ID = "01K0000000000";

async function openDialog(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/w/${WORKSPACE_ID}`);
  await page.getByRole("button", { name: /문의·피드백/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.evaluate((el) =>
    Promise.all(el.getAnimations().map((animation) => animation.finished))
  );
  return dialog;
}

function dialogHeight(page: Page) {
  return page.evaluate(
    () =>
      document
        .querySelector("[data-slot=dialog-content]")!
        .getBoundingClientRect().height
  );
}

async function spacing(page: Page) {
  return page.evaluate(() => {
    const rect = (el: Element) => el.getBoundingClientRect();
    const dialog = rect(document.querySelector("[data-slot=dialog-content]")!);
    const footer = rect(document.querySelector("[data-slot=dialog-footer]")!);
    const buttons = [
      ...document.querySelectorAll("[data-slot=dialog-footer] button"),
    ].map(rect);
    const top = Math.min(...buttons.map((b) => b.top));
    const bottom = Math.max(...buttons.map((b) => b.bottom));
    return {
      above: top - footer.top - 1,
      below: dialog.bottom - bottom,
      footerPastDialog: footer.bottom - dialog.bottom,
    };
  });
}

async function expectEvenSpacing(page: Page) {
  const s = await spacing(page);
  expect(s.footerPastDialog).toBeCloseTo(0, 0);
  expect(s.below).toBeCloseTo(s.above, 0);
  expect(s.below).toBeGreaterThanOrEqual(15);
}

async function heightAfterTabs(page: Page) {
  const heights: number[] = [];
  for (const name of ["보내기", /내 문의/, "보내기"]) {
    await page.getByRole("tab", { name }).click();
    heights.push(await dialogHeight(page));
  }
  return heights;
}

test("보내기 버튼 위·아래 여백이 같고 탭을 오가도 창 높이가 변하지 않는다", async ({
  page,
}) => {
  await openDialog(page);
  await expectEvenSpacing(page);

  const [send, mine, again] = await heightAfterTabs(page);
  expect(mine).toBeCloseTo(send, 0);
  expect(again).toBeCloseTo(send, 0);
});

test("분류 설명이 길어져도 여백이 같고 탭을 오가도 창 높이가 변하지 않는다", async ({
  page,
}) => {
  await openDialog(page);
  const before = await dialogHeight(page);
  await page.getByText("안 되거나 이상해요").evaluate((el) => {
    el.append(" Longer hint text that wraps over several lines.".repeat(8));
  });

  await expectEvenSpacing(page);
  const [send, mine, again] = await heightAfterTabs(page);
  expect(send).toBeGreaterThan(before + 30);
  expect(mine).toBeCloseTo(send, 0);
  expect(again).toBeCloseTo(send, 0);
});

test("입력란에 긴 글을 써도 푸터가 창 안에 남는다", async ({ page }) => {
  await openDialog(page);
  const empty = await dialogHeight(page);

  await page
    .getByLabel("내용")
    .fill(Array.from({ length: 30 }, (_, i) => `${i + 1}번째 줄`).join("\n"));

  await expectEvenSpacing(page);
  expect(await dialogHeight(page)).toBeLessThan(empty + 140);
});

test("보낸 문의가 많아도 창은 늘지 않고 목록만 스크롤한다", async ({
  page,
}) => {
  await openDialog(page);
  const send = await dialogHeight(page);

  for (let i = 1; i <= 5; i++) {
    await page.getByRole("tab", { name: "보내기" }).click();
    await page.getByLabel("내용").fill(`문의 ${i}`);
    await page.getByRole("button", { name: "보내기", exact: true }).click();
    await expect(page.getByText(`문의 ${i}`)).toBeVisible();
  }

  const list = page.locator("[role=tabpanel]:not([inert]) ul");
  await expect
    .poll(() => list.evaluate((el) => el.scrollHeight > el.clientHeight))
    .toBe(true);
  expect(await dialogHeight(page)).toBeCloseTo(send, 0);
});
