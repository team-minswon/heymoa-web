import { expect, test } from "@playwright/test";

/**
 * 프로젝트 개념 요약 화면 — **MSW 목 대상**(APP-464).
 *
 * 첫 프로젝트(`01K0000000001`)는 처음부터 요약이 있고, 둘째(`01K0000000004`)는 첫 조회가
 * 생성을 시작해 두 번 조회 뒤 준비된다(`lib/mocks/meeting-review.ts`).
 */

const WORKSPACE_ID = "01K0000000000";
const READY_PROJECT_ID = "01K0000000001";
const LAZY_PROJECT_ID = "01K0000000004";

test.describe("프로젝트 개념 요약", () => {
  test("사이드바 메뉴에서 열리고 네 묶음과 근거가 보인다", async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_ID}`);
    await page.getByRole("button", { name: "주간 프로젝트 메뉴" }).click();
    await page.getByRole("menuitem", { name: "프로젝트 요약" }).click();
    await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_ID}/projects/${READY_PROJECT_ID}$`));

    const surface = page.getByTestId("project-concept-summary");
    await expect(surface.getByText("AI 가 승인 사실을 설명한 결과")).toBeVisible({ timeout: 20_000 });
    await expect(surface.getByTestId("summary-status")).toHaveAttribute("data-status", "READY");
    for (const title of ["목적과 범위", "핵심 개념과 용어", "현재 방향", "남은 쟁점"]) {
      await expect(surface.getByRole("heading", { name: title })).toBeVisible();
    }
    const statement = surface.getByTestId("summary-statement").nth(1);
    await statement.getByRole("button", { name: /근거 \d/ }).click();
    await expect(statement.getByRole("link", { name: "회의 열기" })).toBeVisible();

    // 근거 인용은 이 프로젝트의 실제 노트 전사로 간다 — 목 표본의 가짜 id 가 아니라.
    const noteHref = await statement.getByRole("link", { name: "회의 열기" }).getAttribute("href");
    const noteId = noteHref?.match(/notes\/([^/?]+)/)?.[1];
    expect(noteId).toBeTruthy();
    await statement.locator("ul button").first().click();
    await expect(page).toHaveURL(new RegExp(`/notes/${noteId}\\?tab=transcript&segment=`));
    await expect(page.getByRole("tabpanel", { name: "전사" }).getByTestId("archive-transcript-block").first()).toBeVisible();
    // 하이라이트는 잠깐이라 잡지 않는다. 대신 URL 의 segment 가 그 노트의 실제 전사에 있는지 본다.
    const segmentId = new URL(page.url()).searchParams.get("segment");
    const segmentIds = await page.evaluate(async (id) => {
      const body = await (await fetch(`/v1/notes/${id}/transcript`)).json();
      return (body.data?.segments ?? []).map((segment: { segmentId: string }) => segment.segmentId);
    }, noteId);
    expect(segmentIds).toContain(segmentId);
  });

  test("요약이 없는 프로젝트는 첫 조회가 생성을 시작하고 준비되면 채워진다", async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_ID}/projects/${LAZY_PROJECT_ID}`);
    const status = page.getByTestId("summary-status");
    await expect(status).toHaveAttribute("data-status", "GENERATING", { timeout: 20_000 });
    await expect(page.getByTestId("refresh-summary")).toBeDisabled();
    await expect(status).toHaveAttribute("data-status", "READY", { timeout: 20_000 });
    await expect(page.getByTestId("refresh-summary")).toBeEnabled();
  });

  test("닫으면 목록으로 돌아가고 노트 목록은 그대로다", async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_ID}/projects/${READY_PROJECT_ID}`);
    await expect(page.getByTestId("project-concept-summary")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "닫기" }).click();
    await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_ID}$`));
    await expect(page.getByRole("button", { name: "새 노트" })).toBeVisible();
  });
});
