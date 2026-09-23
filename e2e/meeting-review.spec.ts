import { expect, test, type Page } from "@playwright/test";

/**
 * 회의 뒤 검토를 서비스 워커 목으로 끝까지 굴린다. vitest 는 jsdom 이라 브라우저 목 경로와
 * 실제 레이아웃(좁은 화면의 넘침, 붙박이 확정 줄)을 지나지 않는다 — 그 둘을 여기서 본다.
 */
const WORKSPACE_ID = "01K0000000000";
const MENTORING_NOTE = "01K0000000920";
const ANALYZING_NOTE = "01K0000000022";

const reviewUrl = (noteId: string) => `/w/${WORKSPACE_ID}/notes/${noteId}?view=full&tab=summary`;

/** 검토 줄 하나. 줄의 내용 버튼을 품은 상자다 */
const rowOf = (page: Page, content: string) =>
  page.locator("[data-item-id]").filter({ has: page.getByRole("button", { name: content, exact: true }) });

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("검토 화면에서 항목을 고치고 제안을 고른 뒤 확정한다", async ({ page }) => {
  await page.goto(reviewUrl(MENTORING_NOTE));
  await expect(page.getByText("검토 중", { exact: true })).toBeVisible({ timeout: 20_000 });

  // 줄 이름은 exact 로 찾는다 — 펼친 줄의 수정 기록 단계 버튼도 같은 문장을 이름에 품는다.
  const decision = page.getByRole("button", { name: "설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다", exact: true });
  await decision.click();
  await expect(page.getByText("처음 나옴")).toBeVisible();

  await page.getByRole("button", { name: "수정", exact: true }).click();
  await page.getByRole("textbox", { name: "항목 내용" }).fill("설문 근거는 출처 · 표본 수 · 조사 연도를 함께 적는다");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "설문 근거는 출처 · 표본 수 · 조사 연도를 함께 적는다", exact: true })
  ).toBeVisible();

  await page.getByRole("button", { name: "첫 화면 메시지는 회의 기록보다 회의 뒤 실행 연결로 둔다", exact: true }).click();
  // 제안은 줄마다 늘 서 있어 같은 이름의 토글이 여럿이다. 그 줄 안에서 찾는다.
  await rowOf(page, "첫 화면 메시지는 회의 기록보다 회의 뒤 실행 연결로 둔다")
    .getByRole("radiogroup", { name: "이전 결정을 끝낼지" })
    .getByRole("radio", { name: /끝내기/ })
    .click();
  await expect(page.getByText(/개 끝남/)).toContainText("이전 결정 1개 끝남");

  // 고를 제안을 다 골라야 확정이 풀린다. 남은 기존 할 일 변경 둘은 유지한다.
  for (const content of ["경쟁 서비스 요금제를 한 표로 정리한다", "구현 결과를 기대 효과 순서로 다시 배치한다"]) {
    const keep = rowOf(page, content)
      .getByRole("radiogroup", { name: "기존 할 일에 반영할지" })
      .getByRole("radio", { name: "유지" });
    await keep.click();
    await expect(keep).toHaveAttribute("aria-checked", "true");
  }

  await page.getByRole("radio", { name: "그래프" }).click();
  await expect(page.getByRole("button", { name: "확대" })).toBeVisible();
  await page.getByRole("radio", { name: "요약" }).click();

  await page.getByRole("button", { name: "검토 완료" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "검토 완료" }).click();
  await expect(page.getByText("확정됨", { exact: true })).toBeVisible({ timeout: 20_000 });
});

test("그래프를 확대 · 이동하고, 점이나 목록에서 항목을 고르면 아래에 수정 기록이 서며 닫을 수 있다", async ({ page }) => {
  await page.goto(reviewUrl(MENTORING_NOTE));
  await expect(page.getByText("검토 중", { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("radio", { name: "그래프" }).click();

  // 힘 배치가 멈추고 판에 맞춘 뒤에 본다. 캔버스라 그린 결과는 화면을 찍어 비교한다.
  const graph = page.locator("[data-review-graph][data-settled]");
  await expect(graph).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(500);
  const canvas = graph.locator("canvas").first();
  const shot = () => canvas.screenshot();

  const fitted = await shot();
  await page.getByRole("button", { name: "확대" }).click();
  await expect.poll(async () => (await shot()).equals(fitted)).toBe(false);

  // 빈 바탕을 끌면 보이는 영역이 따라온다.
  await page.waitForTimeout(300);
  const zoomed = await shot();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 90, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await shot()).equals(zoomed)).toBe(false);
  await page.getByRole("button", { name: "맞춤" }).click();

  // 점을 가리키면 설명 상자가 서고, 누르면 그 항목의 수정 기록이 선다.
  await page.waitForTimeout(400);
  let found = false;
  for (let y = 0.2; y < 0.8 && !found; y += 0.04) {
    for (let x = 0.2; x < 0.8 && !found; x += 0.02) {
      await page.mouse.move(box.x + box.width * x, box.y + box.height * y);
      found = (await page.getByRole("tooltip").count()) > 0;
    }
  }
  expect(found).toBe(true);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "닫기" })).toBeVisible();
  await page.getByRole("button", { name: "닫기" }).click();

  // 캔버스를 못 쓰는 사람은 보이지 않는 목록으로 같은 항목을 고른다.
  await graph.getByRole("button", { name: /무료 구간은 월 5시간으로 두고 팀 요금제에서는 뺀다/ }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("검토에서 수정")).toBeVisible();
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByText("검토에서 수정")).toHaveCount(0);
});

test("분석이 도는 회의는 진행을 보이다가 검토본이 서면 검토 화면으로 넘어간다", async ({ page }) => {
  await page.goto(reviewUrl(ANALYZING_NOTE));
  await expect(page.getByText("회의를 분석하는 중입니다")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("검토 중", { exact: true })).toBeVisible({ timeout: 30_000 });
});

test.describe("좁은 화면", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("검토 요약 · 그래프 · 할 일이 가로로 넘치지 않는다", async ({ page }) => {
    await page.goto(reviewUrl(MENTORING_NOTE));
    await expect(page.getByText("검토 중", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /경쟁 서비스 요금제를 한 표로 정리한다/ }).click();
    await expect(
      rowOf(page, "경쟁 서비스 요금제를 한 표로 정리한다").getByRole("radiogroup", { name: "기존 할 일에 반영할지" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("radio", { name: "그래프" }).click();
    await expect(page.getByRole("button", { name: "확대" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto(`/w/${WORKSPACE_ID}/tasks`);
    await expect(page.getByRole("radio", { name: /진행 중/ })).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
  });
});
