import { expect, test, type Page } from "@playwright/test";

/**
 * 회의 뒤 검토를 서비스 워커 목으로 끝까지 굴린다. vitest 는 jsdom 이라 브라우저 목 경로와
 * 실제 레이아웃(좁은 화면의 넘침, 붙박이 확정 줄)을 지나지 않는다 — 그 둘을 여기서 본다.
 */
const WORKSPACE_ID = "01K0000000000";
const MENTORING_NOTE = "01K0000000920";
const ANALYZING_NOTE = "01K0000000022";

const reviewUrl = (noteId: string, approvalCase = "all-selected") => `/w/${WORKSPACE_ID}/notes/${noteId}?view=full&tab=summary&reviewCase=${approvalCase}`;

test("최종 회의 정리와 안건 요약 전문, 강한 관계와 이어짐을 읽는다", async ({
  page,
}) => {
  await page.goto(reviewUrl(MENTORING_NOTE));
  const overview = page.getByRole("region", { name: "요약", exact: true });
  await expect(overview).toContainText(
    "문제 정의를 「회의 뒤 할 일이 확정되지 않는다」로 좁히고", { timeout: 20_000 }
  );
  await expect(overview).toContainText("온톨로지 작업은 다음 학기로 넘겼다.");
  await expect(overview).not.toContainText(
    "회의 뒤 할 일이 흐려지는 문제를 주제별 확정으로 풀기로 했다"
  );
  const index = page.getByRole("list", { name: "주제 목차" });
  await index
    .getByRole("link", {
      name: "회의가 끝난 뒤 할 일이 흐려지는 문제",
      exact: true,
    })
    .click();
  await expect(
    index.getByRole("button", { name: /회의가 끝난 뒤 할 일이 흐려지는 문제/ })
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("region", { name: "충돌·이어짐", exact: true })
  ).toHaveCount(0);
  const decisions = page.getByRole("region", { name: "결정", exact: true });
  await decisions.getByRole("button", { name: "더 불러오기" }).click();
  const pricing = decisions
    .locator("[data-item-id]")
    .filter({
      has: page.getByRole("button", {
        name: "요금은 좌석이 아니라 회의 시간 기준으로 계산한다",
        exact: true,
      }),
    });
  await expect(
    pricing.getByText("대체", { exact: true })
  ).toBeVisible();
  await expect(pricing.getByText("이어짐", { exact: true })).toBeVisible();
  await expect(pricing).toContainText("프로젝트 확정 항목");
  await expect(pricing).toContainText(
    "좌석 수 대신 실제 회의 시간을 과금 기준으로 정했습니다."
  );
  const replacement = decisions
    .locator("[data-item-id]")
    .filter({
      has: page.getByRole("button", {
        name: "첫 화면 메시지는 회의 기록보다 회의 뒤 실행 연결로 둔다",
        exact: true,
      }),
    });
  await expect(
    replacement.getByRole("radiogroup", { name: "이전 결정을 어떻게 할까요?" })
  ).toHaveCount(1);
  await expect(
    replacement.getByText("첫 화면 메시지는 회의 기록 품질로 둔다", {
      exact: true,
    })
  ).toHaveCount(1);
  await page.getByRole("radio", { name: "그래프" }).click();
  await expect(page.getByRole("list", { name: "안건 이어짐" })).toContainText("회의가 끝난 뒤 할 일이 흐려지는 문제 → 02 차별점과 요금");

});

/** 검토 줄 하나. 줄의 내용 버튼을 품은 상자다 */
const rowOf = (page: Page, content: string) =>
  page.locator("[data-item-id]").filter({ has: page.getByRole("button", { name: content, exact: true }) });

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("분석 중에는 삭제 확인을 비활성화한다", async ({ page }) => {
  await page.goto(reviewUrl(ANALYZING_NOTE));
  await page.getByRole("button", { name: "노트 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "삭제", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText("회의 분석이 끝난 뒤 삭제할 수 있어요.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "삭제", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("button", { name: "노트 메뉴", exact: true })).toBeVisible();
});

for (const [state, noteId] of [
  ["미분석", "01K0000000023"],
  ["분석 완료", "01K0000000021"],
  ["승인 완료", "01K0000000024"],
  ["분석 실패", "01K0000000026"],
] as const) {
  test(`${state} 회의는 삭제하고 다시 열면 재노출하지 않는다`, async ({ page }) => {
    await page.goto(reviewUrl(noteId));
    await page.getByRole("button", { name: "노트 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "삭제", exact: true }).click();
    const button = page.getByRole("alertdialog").getByRole("button", { name: "삭제", exact: true });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.getByText("회의를 삭제했습니다.", { exact: true })).toBeVisible();
    await expect(page.locator(`a[href*="/notes/${noteId}"]`)).toHaveCount(0);
    await page.goto(reviewUrl(noteId));
    await expect(page.getByRole("button", { name: "노트 메뉴", exact: true })).toHaveCount(0);
  });
}

test("검토 화면에서 항목을 고치고 제안을 고른 뒤 확정한다", async ({ page }) => {
  await page.goto(reviewUrl(MENTORING_NOTE));
  await expect(page.getByText("검토 중", { exact: true })).toBeVisible({ timeout: 20_000 });

  // 줄 이름은 exact 로 찾는다 — 「언제 정해졌나」의 표시도 같은 문장을 이름에 품는다.
  const decision = page.getByRole("button", { name: "설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다", exact: true });
  await decision.click();
  await expect(page.getByRole("list", { name: "근거 발언", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "수정", exact: true }).click();
  await page.getByRole("textbox", { name: "항목 내용" }).fill("설문 근거는 출처 · 표본 수 · 조사 연도를 함께 적는다");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "설문 근거는 출처 · 표본 수 · 조사 연도를 함께 적는다", exact: true })
  ).toBeVisible();

  await page.getByRole("button", { name: "첫 화면 메시지는 회의 기록보다 회의 뒤 실행 연결로 둔다", exact: true }).click();
  // 제안은 줄마다 늘 서 있어 같은 이름의 토글이 여럿이다. 그 줄 안에서 찾는다.
  await rowOf(page, "첫 화면 메시지는 회의 기록보다 회의 뒤 실행 연결로 둔다")
    .getByRole("radiogroup", { name: "이전 결정을 어떻게 할까요?" })
    .getByRole("radio", { name: /대체/ })
    .click();
  await expect(page.getByText(/확인할 제안/)).toContainText("확인할 제안 2개");

  // 고를 제안을 다 골라야 확정이 풀린다. 남은 기존 할 일 변경 둘은 넘긴다.
  for (const content of ["경쟁 서비스 요금제를 한 표로 정리한다", "구현 결과를 기대 효과 순서로 다시 배치한다"]) {
    const keep = rowOf(page, content)
      .getByRole("radiogroup", { name: "기존 할 일에 반영할지" })
      .getByRole("radio", { name: "넘기기" });
    await keep.click();
    await expect(keep).toHaveAttribute("aria-checked", "true");
  }
  await expect(page.getByText(/개 추가/)).toContainText("이전 결정 1개 끝남");

  await page.getByRole("radio", { name: "그래프" }).click();
  await expect(page.getByRole("button", { name: "확대" })).toBeVisible();
  await page.getByRole("radio", { name: "요약" }).click();

  await page.getByRole("button", { name: "검토 완료" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "검토 완료" }).click();
  await expect(page.getByText("확정됨", { exact: true })).toBeVisible({ timeout: 20_000 });
});

test("기존 할 일은 반영·넘기기를 바꿔도 그대로이고 검토 완료 때 편집한 초안이 적용된다", async ({ page }) => {
  const taskWrites: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && /\/tasks\//.test(request.url())) taskWrites.push(request.url());
  });
  await page.goto(reviewUrl(MENTORING_NOTE));
  await expect(page.getByText("검토 중", { exact: true })).toBeVisible({ timeout: 20_000 });
  const tasksUrl = await page.evaluate(async ({ noteId, workspaceId }) => {
    const { data: note } = await (await fetch(`/v1/notes/${noteId}`)).json();
    return `/v1/workspaces/${workspaceId}/projects/${note.projectId}/tasks`;
  }, { noteId: MENTORING_NOTE, workspaceId: WORKSPACE_ID });
  const readTasks = () => page.evaluate(async (url) => (await (await fetch(url)).json()).data.tasks, tasksUrl);
  const before = await readTasks();
  const target = before.find((task: { content: string }) => task.content === "경쟁 서비스 요금제를 표로 정리한다");
  expect(target).toBeTruthy();
  const row = rowOf(page, "경쟁 서비스 요금제를 한 표로 정리한다");
  const choice = row.getByRole("radiogroup", { name: "기존 할 일에 반영할지" });
  await choice.getByRole("radio", { name: "반영", exact: true }).click();
  await expect(choice.getByRole("radio", { name: "반영 예정" })).toHaveAttribute("aria-checked", "true");
  await row.getByRole("group", { name: "기존 할 일 변경", exact: true }).locator('input[type="date"]').fill("2026-12-05");
  await expect.poll(() => page.evaluate(async ({ noteId, taskId }) => {
    const { data: review } = await (await fetch(`/v1/notes/${noteId}/meeting-review`)).json();
    return review.items.flatMap((item: { taskChanges: Array<{ target: { itemId: string }; draft?: { due?: { value: string } } }> }) => item.taskChanges)
      .find((change: { target: { itemId: string } }) => change.target.itemId === taskId)?.draft?.due?.value;
  }, { noteId: MENTORING_NOTE, taskId: target.taskId })).toBe("2026-12-05");
  await choice.getByRole("radio", { name: "넘기기" }).click();
  await expect(choice.getByRole("radio", { name: "넘기기" })).toHaveAttribute("aria-checked", "true");
  expect(await readTasks()).toEqual(before);
  await choice.getByRole("radio", { name: "반영", exact: true }).click();
  await expect(choice.getByRole("radio", { name: "반영 예정" })).toHaveAttribute("aria-checked", "true");
  expect(await readTasks()).toEqual(before);

  await rowOf(page, "첫 화면 메시지는 회의 기록보다 회의 뒤 실행 연결로 둔다")
    .getByRole("radio", { name: "유지" }).click();
  await rowOf(page, "구현 결과를 기대 효과 순서로 다시 배치한다")
    .getByRole("radio", { name: "넘기기" }).click();
  await expect(page.getByText(/개 추가/)).toContainText("기존 할 일 1개 변경");
  await page.getByRole("button", { name: "검토 완료" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("기존 할 일 1개가 변경됩니다.");
  await page.getByRole("alertdialog").getByRole("button", { name: "검토 완료" }).click();
  await expect(page.getByText("확정됨", { exact: true })).toBeVisible({ timeout: 20_000 });
  const applied = (await readTasks()).find((task: { taskId: string }) => task.taskId === target.taskId);
  expect(applied).toMatchObject({ assignee: null, due: "2026-12-05", revision: target.revision + 1 });
  await expect(choice.getByRole("radio", { name: "반영됨" })).toBeDisabled();
  await expect(row.getByText("검토 완료 때 적용됩니다.")).toHaveCount(0);
  await expect(row.getByText(/이 제안을 반영할 수 없습니다/)).toHaveCount(0);
  expect(taskWrites).toEqual([]);
});

test("재진입 GET에서 사라진 제안의 저장 선택을 해제하고 업무는 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && /\/tasks\//.test(request.url())) writes.push(request.url());
  });
  await page.goto(reviewUrl(MENTORING_NOTE));
  await expect(page.getByText("검토 중", { exact: true })).toBeVisible({ timeout: 20_000 });
  const decision = rowOf(page, "첫 화면 메시지는 회의 기록보다 회의 뒤 실행 연결로 둔다");
  const action = rowOf(page, "경쟁 서비스 요금제를 한 표로 정리한다");
  await decision.getByRole("radio", { name: "대체" }).click();
  await expect(decision.getByRole("radio", { name: "대체" })).toHaveAttribute("aria-checked", "true");
  await action.getByRole("radio", { name: "반영", exact: true }).click();
  await expect(action.getByRole("radio", { name: "반영 예정" })).toHaveAttribute("aria-checked", "true");

  // 요청은 실제 MSW를 통과합니다. 조회/저장 응답의 현재 제안만 숨겨 새 주기 응답을 재현합니다.
  // 서버의 실제 주기 전환과 409 원자성은 별도 Mock OFF QA로 검증합니다.
  await page.evaluate((noteId) => {
    const original = window.fetch.bind(window);
    const reviewPath = `/v1/notes/${noteId}/meeting-review`;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await original(...args);
      const input = args[0];
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (response.ok && (url.pathname === reviewPath || url.pathname.startsWith(`${reviewPath}/items/`))) {
        const body = await response.clone().json();
        for (const item of body.data.items) { item.replacements = []; item.taskChanges = []; }
        return new Response(JSON.stringify(body), { status: response.status, headers: response.headers });
      }
      return response;
    };
  }, MENTORING_NOTE);
  await page.getByRole("tab", { name: "정보", exact: true }).click();
  await expect(page.getByRole("tab", { name: "정보", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "요약", exact: true }).click();
  await expect(decision.getByText("이전 분석의 선택 · 대체")).toBeVisible();
  await expect(action.getByText("이전 분석의 선택 · 반영 예정")).toBeVisible();
  await expect(page.getByRole("button", { name: "검토 완료", exact: true })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
  const cleared = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes("/meeting-review/items/"));
  await decision.getByRole("button", { name: /대체 선택 해제/ }).click();
  const patch = (await cleared).request().postDataJSON();
  expect(patch.decisions).toEqual([{ targetId: expect.any(String), decision: null }]);
  await expect(decision.getByRole("button", { name: /선택 해제/ })).toHaveCount(0);
  await action.getByRole("button", { name: /반영 예정 선택 해제/ }).click();
  await expect(action.getByRole("button", { name: /선택 해제/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "검토 완료", exact: true })).toBeEnabled();
  await expectNoHorizontalOverflow(page);
  expect(writes).toEqual([]);
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
  await expect(page.getByRole("button", { name: "닫기", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();

  // 캔버스를 못 쓰는 사람은 보이지 않는 목록으로 같은 항목을 고른다.
  await graph.getByRole("button", { name: /무료 구간은 월 5시간으로 두고 팀 요금제에서는 뺀다/ }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "연결된 안건" })).toContainText("차별점과 요금");
  await expect(page.getByText("검토에서 수정")).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
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

    await page.getByRole("button", { name: "경쟁 서비스 요금제를 한 표로 정리한다", exact: true }).click();
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


test("반영은 기본 OFF이고 스위치를 켜야 대체·유지가 나타난다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(reviewUrl(MENTORING_NOTE, "default"));
  const decision = rowOf(page, "첫 화면 메시지는 회의 기록보다 회의 뒤 실행 연결로 둔다");
  const toggle = decision.getByRole("switch");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(decision.getByRole("radiogroup")).toHaveCount(0);
  await toggle.click();
  const replace = decision.getByRole("radio", { name: "대체", exact: true });
  await expect(replace).toBeVisible();
  await replace.click();
  await expect(decision.locator("del")).toContainText("첫 화면 메시지는 회의 기록 품질로 둔다");
  await expect(decision.getByRole("group", { name: "대체 후 모습" })).toContainText("결정 1개");
  await decision.getByRole("radio", { name: "유지", exact: true }).click();
  await expect(decision.getByRole("group", { name: "함께 유지할 결정" }).getByRole("listitem")).toHaveCount(2);
  await expect(decision.locator("del")).toHaveCount(0);
  await toggle.click();
  await expect(decision.getByRole("radiogroup")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
