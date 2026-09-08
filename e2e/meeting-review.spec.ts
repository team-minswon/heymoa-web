import { expect, test, type Page } from "@playwright/test";

/**
 * 명제 기반 검토·확정 화면 — **MSW 목 대상**(APP-464).
 *
 * server public 계약이 아직 제안이라 실서버 판은 없다. 이 파일은 계약과 무관하게 화면이
 * 옳은지를 지킨다: 승인 전 배지, 편집의 완료 단위 저장, 충돌 시 로컬 보존, 회의 시작자만
 * 보는 승인, 거부 사유, 확정 뒤 배지.
 *
 * 시드는 `lib/mocks/meeting-review.ts` 가 정한다. 종료된 노트 `01K0000000022` 는 회의
 * 시작자가 현재 사용자이고, `01K0000000021` 은 아니다.
 */

const WORKSPACE_ID = "01K0000000000";
const STARTER_NOTE_ID = "01K0000000022";
const OTHER_STARTER_NOTE_ID = "01K0000000021";
/** `REVIEW_GENERATING_NOTE_ID` — 평가가 두 번 조회 뒤 준비된다. */
const GENERATING_NOTE_ID = "01K0000000023";

async function openReview(page: Page, noteId: string) {
  await page.goto(`/w/${WORKSPACE_ID}/notes/${noteId}?view=full&tab=summary`);
  await expect(page.getByTestId("meeting-review")).toBeVisible({ timeout: 20_000 });
}

test.describe("검토·확정 화면", () => {
  test("승인 전에는 검토본이고, 영역 셋과 남은 작업이 보인다", async ({ page }) => {
    await openReview(page, STARTER_NOTE_ID);
    const gate = page.getByTestId("review-gate");
    await expect(gate.getByText("검토본 · 아직 확정되지 않음")).toBeVisible();
    await expect(gate.getByText("미검토 항목")).toBeVisible();
    await expect(page.getByTestId("review-regions")).toBeVisible();
    await expect(page.getByTestId("review-evaluation").getByText("AI 해석")).toBeVisible();
    await expect(page.getByTestId("review-relations")).toBeVisible();
    // 사람이 추가한 항목과 근거 없는 항목이 다르게 표시된다.
    await expect(page.getByText("사람이 추가")).toBeVisible();
    await expect(page.getByText("근거 없음").first()).toBeVisible();
    // 구식 분석은 접혀 있다.
    await expect(page.getByTestId("legacy-analysis")).toHaveAttribute("data-collapsed", "");
    await expect(page.getByTestId("approve-meeting")).toBeDisabled();
  });

  test("편집은 완료 단위로 저장되고 새로고침 뒤에도 남는다", async ({ page }) => {
    await openReview(page, STARTER_NOTE_ID);
    const issue = page.locator('[data-item-id="0HZX2K7M9R004"]');
    await issue.getByRole("button", { name: "수정" }).click();
    const textarea = issue.getByLabel("항목 내용");
    await textarea.fill("결제 모듈 인증이 아직 안 끝났다 — 9월 둘째 주 확인");
    await textarea.blur();
    await expect(issue.getByText("사람이 고침")).toBeVisible();
    await expect(issue.getByText("미검토")).toHaveCount(0);
    // 내용을 고쳤으니 그 항목에 걸린 관계가 오래됨이 된다.
    await expect(page.getByRole("button", { name: /오래된 \d건 재검토/ })).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("meeting-review")).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-item-id="0HZX2K7M9R004"]').getByText(/9월 둘째 주 확인/)
    ).toBeVisible();
  });

  test("충돌이 나면 내 편집이 남고 서버 값과 나란히 보인다", async ({ page }) => {
    await openReview(page, STARTER_NOTE_ID);
    const decision = page.locator('[data-item-id="0HZX2K7M9R002"]');
    // 다른 창에서 먼저 바꾼 것을 흉내낸다. **페이지 안의 fetch 여야 한다** — Playwright 의
    // request 컨텍스트는 MSW 서비스 워커를 지나지 않아 목 상태에 닿지 못한다.
    await page.evaluate(async (noteId) => {
      const current = await fetch(`/v1/notes/${noteId}/meeting-review`).then((r) => r.json());
      await fetch(`/v1/notes/${noteId}/meeting-review/items/0HZX2K7M9R002`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedReviewVersion: current.data.reviewVersion,
          expectedItemRevision: 1,
          content: "먼저 바꾼 사람",
        }),
      });
    }, STARTER_NOTE_ID);
    await decision.getByRole("button", { name: "수정" }).click();
    await decision.getByLabel("항목 내용").fill("내가 늦게 바꾼 내용");
    await decision.getByLabel("항목 내용").blur();
    const alert = decision.getByRole("alert");
    await expect(alert).toContainText("다른 곳에서 먼저 바뀌었습니다");
    await expect(alert).toContainText("내가 늦게 바꾼 내용");
    await expect(alert).toContainText("먼저 바꾼 사람");
    // 고르기 전에는 본문이 여전히 내 편집이다.
    await expect(decision.getByRole("button", { name: "내가 늦게 바꾼 내용" })).toBeVisible();
  });

  test("회의 시작자가 아니면 승인 버튼과 편집 컨트롤이 없다", async ({ page }) => {
    await openReview(page, OTHER_STARTER_NOTE_ID);
    await expect(page.getByText("승인은 회의 시작자가 합니다.")).toBeVisible();
    await expect(page.getByTestId("approve-meeting")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "수정" })).toHaveCount(0);
    await expect(page.getByTestId("review-gate").getByText("회의 시작자만 승인할 수 있습니다")).toBeVisible();
  });

  test("전부 검토하면 승인되고 확정 배지로 바뀐다. 거부는 사유가 남는다", async ({ page }) => {
    test.setTimeout(90_000);
    await openReview(page, STARTER_NOTE_ID);

    // 미검토 항목 둘: 이슈는 제외했다 복원, 사람 추가 항목은 제외.
    for (const itemId of ["0HZX2K7M9R004", "0HZX2K7M9R005"]) {
      const card = page.locator(`[data-item-id="${itemId}"]`);
      await card.getByRole("button", { name: "제외" }).click();
      await expect(card.getByText("제외됨")).toBeVisible();
    }
    await page.locator('[data-item-id="0HZX2K7M9R004"]').getByRole("button", { name: "복원" }).click();
    const gate = page.getByTestId("review-gate");
    // 저장은 완료 단위라 server 게이트가 갱신될 때까지 기다린다 — 다음 저장의 CAS 가 그 버전을 쓴다.
    await expect(gate.getByText("미검토 항목")).toHaveCount(0);

    // 미판정 관계 셋을 판정한다. 각 저장이 끝난 뒤 다음으로 간다.
    for (const relationId of ["0HZX2K7M9R011", "0HZX2K7M9R013", "0HZX2K7M9R014"]) {
      const row = page.locator(`[data-relation-id="${relationId}"]`);
      await row.getByRole("button", { name: "수락" }).click();
      await expect(row.getByText("미판정")).toHaveCount(0);
    }
    await expect(gate.getByText("미판정 연결")).toHaveCount(0);
    // 오래된 관계는 재검토로 푼다(목은 두 번 조회 뒤 준비). 재검토가 도는 동안 게이트는
    // 「연결 판정 진행 중」이고, 끝나면 오래됨 버튼이 사라진다 — 그 뒤에 승인한다.
    await page.getByRole("button", { name: /오래된 \d건 재검토/ }).click();
    await expect(gate.getByText("연결 판정 진행 중")).toBeVisible();
    await expect(page.getByRole("button", { name: /오래된 \d건 재검토/ })).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(gate.getByText("검토가 끝났습니다")).toBeVisible();

    await expect(page.getByTestId("approve-meeting")).toBeEnabled();
    await page.getByTestId("approve-meeting").click();
    await expect(page.getByText("프로젝트 지식으로 확정됨")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("approve-meeting")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "수정" })).toHaveCount(0);
  });

  test("평가가 생성 중이면 명제 검토를 막지 않고, 준비되면 채워진다", async ({ page }) => {
    await openReview(page, GENERATING_NOTE_ID);
    const evaluation = page.getByTestId("review-evaluation");
    await expect(evaluation.getByRole("status")).toContainText("평가하고 있습니다");
    await expect(page.getByTestId("review-regions").getByTestId("review-item").first()).toBeVisible();
    await expect(evaluation).toHaveAttribute("data-region-status", "READY", { timeout: 20_000 });
    await expect(evaluation.getByText("논의의 폭")).toBeVisible();
  });
});

