import { expect, test } from "@playwright/test";

/**
 * 회의 중 안건이 실시간으로 정해지는 흐름 — **MSW 목 대상**.
 *
 * 목은 `LIVE_AGENDA_NOTE_ID` 에만 명제와 `agendas.changed` 를 흘린다(`lib/mocks/live-agendas.ts`).
 * 마지막 정리는 처음 온보딩으로 정한 「이탈률」 줄을 결제 주제로 옮기는데, 회의 중이라 화면은 그 줄을
 * 옮기지 않아야 한다.
 */
const timelineUrl = "/w/01K0000000000/notes/01K0000000016?view=full&tab=context";

test("안건 제목이 실시간으로 끼어들고, 자리를 정한 줄은 회의 중에 옮기지 않는다", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(timelineUrl);

  const heading = (name: string) => page.getByRole("button", { name: new RegExp(`^${name}`) });
  await expect(heading("온보딩 개편").first()).toBeVisible({ timeout: 20_000 });
  // 마지막 정리까지 기다린다 — 새 주제가 끼어들고 「논의 중」이 붙는다
  await expect(heading("하반기 채용")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("논의 중")).toBeVisible();

  const groupOf = (text: string) =>
    page.locator("section", { has: page.getByText(text, { exact: true }) }).locator("h3");
  await expect(groupOf("지난주 온보딩 이탈률은 38%였다")).toContainText("온보딩 개편");
  // 같은 주제로 돌아오면 제목이 한 번 더 선다
  await expect(heading("온보딩 개편")).toHaveCount(2);
  await expect(groupOf("튜토리얼에 건너뛰기 버튼을 둔다")).toContainText("온보딩 개편");
});
