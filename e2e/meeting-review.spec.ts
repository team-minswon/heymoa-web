import { expect, test, type Page } from "@playwright/test";

/**
 * 회의 검토본 — **MSW 목 대상**. 시나리오는 `lib/mocks/meeting-review.ts`가 정한다.
 * 노트 `…20`은 내가 시작했고 전사가 있다. `…21`은 남이 시작했다. `…24`는 검토본이 없다.
 */
const WORKSPACE_ID = "01K0000000000";
const REVIEW_NOTE_ID = "01K0000000020";
const OTHER_STARTER_NOTE_ID = "01K0000000021";
const EMPTY_NOTE_ID = "01K0000000024";

function openSummary(page: Page, noteId: string) {
  return page.goto(`/w/${WORKSPACE_ID}/notes/${noteId}?view=full&tab=summary`);
}

test.describe("회의 검토본", () => {
  test("섹션을 kind 순서로 세우고 근거를 펼치면 전사 줄이 보인다", async ({ page }) => {
    await openSummary(page, REVIEW_NOTE_ID);
    const headings = page.getByTestId("meeting-review").getByRole("heading", { level: 2 });
    await expect(headings).toHaveText(["안건", "결정", "할 일", "이슈", "질문", "인사이트"]);

    await page.getByRole("button", { name: /첫 화면에서 회의 만들기를/ }).click();
    await expect(page.getByText("그럼 첫 화면에 회의 만들기를 눈에 띄게 두죠.")).toBeVisible();
  });

  test("수정과 제외는 완료 단위로 저장되고 화면에 그대로 남는다", async ({ page }) => {
    await openSummary(page, REVIEW_NOTE_ID);
    // 내용은 바뀔 것이므로 메타(담당)로 줄을 잡는다.
    const row = page.getByTestId("review-item").filter({ hasText: "담당 한지원" });
    await row.hover();
    await row.getByRole("button", { name: "수정" }).click();
    const editor = page.getByRole("textbox", { name: "항목 내용" });
    await editor.fill("회의를 아직 안 만든 사람에게 예시 회의 둘을 깔아 둔다");
    await editor.press("Enter");
    await expect(row).toContainText("예시 회의 둘을 깔아 둔다");
    await expect(row).toContainText("고침");

    await row.hover();
    await row.getByRole("button", { name: "제외" }).click();
    await expect(row).toHaveAttribute("data-excluded", "");
    await row.hover();
    await row.getByRole("button", { name: "복원" }).click();
    await expect(row).not.toHaveAttribute("data-excluded", "");
  });

  test("시작자가 아니면 읽기만 한다", async ({ page }) => {
    await openSummary(page, OTHER_STARTER_NOTE_ID);
    await expect(page.getByRole("heading", { level: 2, name: "결정" })).toBeVisible();
    await expect(page.getByRole("button", { name: "항목 추가" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "수정" })).toHaveCount(0);
  });

  test("검토본이 없으면 만들고 항목을 더한다", async ({ page }) => {
    await openSummary(page, EMPTY_NOTE_ID);
    await page.getByRole("button", { name: "검토본 만들기" }).click();
    await expect(page.getByText("검토할 항목이 없습니다.")).toBeVisible();
    await page.getByRole("button", { name: "항목 추가" }).click();
    await page.getByRole("combobox", { name: "항목 종류" }).selectOption("ACTION_ITEM");
    await page.getByRole("textbox", { name: "항목 내용" }).fill("로드맵 초안을 다음 주에 공유한다");
    await page.getByRole("button", { name: "추가", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: "할 일" })).toBeVisible();
    await expect(page.getByText("로드맵 초안을 다음 주에 공유한다")).toBeVisible();
    await expect(page.getByText("직접 추가")).toBeVisible();
  });
});
