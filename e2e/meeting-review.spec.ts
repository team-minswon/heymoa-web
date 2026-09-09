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
    await expect(headings).toHaveText(["결론", "논의 중", "참고"]);
    // 참고는 접혀서 시작한다.
    await expect(page.getByText("문구가 아니라 다음에 할 일이 보이지 않는")).not.toBeVisible();

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

    await row.hover();
    await row.getByRole("button", { name: "제외" }).click();
    // 제외하면 묶음 끝의 접힌 목록으로 옮겨 간다.
    await expect(row).not.toBeVisible();
    await page.getByRole("button", { name: /제외 \d개 펼치기/ }).click();
    const excluded = page.getByTestId("review-item").filter({ hasText: "예시 회의 둘을" });
    await expect(excluded).toHaveAttribute("data-excluded", "");
    await excluded.hover();
    await excluded.getByRole("button", { name: "복원" }).click();
    await expect(page.getByTestId("review-item").filter({ hasText: "예시 회의 둘을" })).not.toHaveAttribute("data-excluded", "");
  });

  test("시작자가 아니면 읽기만 한다", async ({ page }) => {
    await openSummary(page, OTHER_STARTER_NOTE_ID);
    await expect(page.getByRole("heading", { level: 2, name: "결론" })).toBeVisible();
    await expect(page.getByRole("button", { name: "항목 추가" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "수정" })).toHaveCount(0);
  });

  test("검토본이 없으면 만들고 항목을 더한다", async ({ page }) => {
    await openSummary(page, EMPTY_NOTE_ID);
    await page.getByRole("button", { name: "검토본 만들기" }).click();
    await expect(page.getByText("이 회의에서는 나오지 않았습니다.")).toBeVisible();
    await page.getByRole("button", { name: "항목 추가" }).click();
    await page.getByRole("combobox", { name: "항목 종류" }).selectOption("ACTION_ITEM");
    await page.getByRole("textbox", { name: "항목 내용" }).fill("로드맵 초안을 다음 주에 공유한다");
    await page.getByRole("button", { name: "추가", exact: true }).click();
    await expect(page.getByText("로드맵 초안을 다음 주에 공유한다")).toBeVisible();
    await expect(page.getByText("담당 미정 · 기한 미정")).toBeVisible();
  });
});
