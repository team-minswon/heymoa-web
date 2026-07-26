import { expect, test } from "@playwright/test";

/**
 * MSW의 브라우저 서비스 워커 경로를 덮는 스모크. vitest는 jsdom이라 이 경로를 지나지 않는데
 * Vercel `dev` 배포가 정확히 여기로 돈다.
 *
 * 시각 회귀는 넣지 않는다 — 화면 구현 이슈마다 baseline을 갱신해야 해서 내내 시끄럽다.
 */

const MOCK_WORKSPACE_ID = "01K0000000000";

test("boots with the MSW service worker registered", async ({ page }) => {
  await page.goto("/");

  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);
});

test("renders the workspace surface from mock data", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  await expect(page.getByText("테스트 유저의 워크스페이스")).toBeVisible();
});

/**
 * 이 테스트가 이 파일의 핵심이다 — 신규 목이 jsdom이 아니라 **서비스 워커 경로에서도**
 * 응답하는지의 증거다. 여기가 깨지면 Vercel 데모에서 새 화면이 전부 빈 화면이 된다.
 */
test("serves a new endpoint through the service worker", async ({ page }) => {
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);

  const payload = await page.evaluate(async () => {
    const response = await fetch("/v1/notifications", {
      credentials: "include",
    });
    return { status: response.status, body: await response.json() };
  });

  expect(payload.status).toBe(200);
  expect(payload.body.success).toBe(true);
  expect(payload.body.data.unreadCount).toBeGreaterThanOrEqual(0);
});

test("streams chat tokens through the service worker", async ({ page }) => {
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);

  const events = await page.evaluate(async () => {
    const created = await fetch("/v1/agent-chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        scope: "workspace",
        workspaceId: "01K0000000000",
      }),
    }).then((response) => response.json());

    const stream = await fetch(
      `/v1/agent-chats/${created.data.chatId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: "요약해줘" }),
      }
    );

    const text = await stream.text();
    return text
      .split("\n\n")
      .filter((block) => block.startsWith("event:"))
      .map((block) => block.split("\n")[0].slice("event:".length).trim());
  });

  expect(events[0]).toBe("message_start");
  expect(events.at(-1)).toBe("message_end");
});

/**
 * 개인 챗봇 한 턴을 화면에서 끝까지 굴린다. 위 테스트가 목의 스트림을 확인한다면 이건
 * `useChatStream`이 실제 브라우저에서 그 스트림을 읽어 그리는지의 증거다.
 */
test("streams a personal chat turn from the panel", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();
  await expect(page.getByText("아직 시작된 대화가 없습니다.")).toBeVisible();

  await page.getByLabel("메시지").fill("요약해줘");
  await page.getByRole("button", { name: "보내기" }).click();

  // MSW 응답은 시드 기반 풀에서 뽑혀 문장이 매번 다를 수 있다 — 어시스턴트 답변이 스트리밍돼
  // 실제 문장(모든 후보가 "습니다."로 끝남)으로 채워지는지만 확인한다.
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );
});

/**
 * 회의 종료 → 분석 대기 흐름을 화면에서 굴린다. 시작자 조작(회의 종료)·확인 다이얼로그·
 * 종료 후 요약 탭이 분석 진행으로 넘어가는지 서비스 워커 경로로 확인한다.
 * `01K0000000002`는 시작자가 목 유저라 조작 버튼이 뜬다.
 */
/**
 * APP-218에서 회의 중지·재개를 폐기했다 — 상단바의 회의 조작은 `회의 종료` 하나다.
 * "멈춤"의 창구는 레코더 독(전사 세션)이고, 쉬는 시간에는 녹음만 멈춘다.
 *
 * 계약에서 경로가 사라졌으므로 버튼이 남으면 404를 부른다. 서비스 워커 경로로 확인한다.
 */
test("shows only the end-meeting control in the note toolbar", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);

  await expect(page.getByRole("button", { name: "회의 종료" })).toBeVisible();
  await expect(page.getByRole("button", { name: "중지" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "재개" })).toHaveCount(0);
  // 녹음 시작은 독이 계속 맡는다 — 축이 사라진 게 아니라 하나로 합쳐졌다.
  await expect(page.getByRole("button", { name: "기록 시작" })).toBeVisible();
});

test("ends a meeting and shows the analysis in progress", async ({ page }) => {
  // 기본 전사 탭에서 종료해도 요약 탭으로 넘어가 분석 진행을 보여야 한다.
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);

  await page.getByRole("button", { name: "회의 종료" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText(/녹음 상태/)).toBeVisible();
  await dialog.getByRole("button", { name: "회의 종료" }).click();

  // 종료 → 분석 PENDING → 요약 탭이 분석 진행으로.
  await expect(page.getByText("회의를 정리하고 있습니다")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("회의 종료됨")).toBeVisible();
});

/**
 * 쓰기 도구 승인 한 흐름을 화면에서 굴린다 — 목은 "이슈"가 든 메시지에서 실제로 멈춰
 * 승인을 기다린다(sse-handler). 승인 카드 → 승인 → 승인·실행 기록까지 서비스 워커 경로로 확인.
 */
test("approves a write tool from the chat card", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();
  await page
    .getByRole("button", { name: "논의된 이슈를 Linear 이슈로 만들어줘" })
    .click();

  // 승인 카드가 뜨고 300초 상한 문구가 있다.
  await expect(page.getByText(/5분 뒤 자동으로 거절/)).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "승인" }).click();

  // 승인 → 실행 기록(외부 링크 포함)이 남는다.
  await expect(page.getByText("APP-12 생성됨")).toBeVisible({
    timeout: 20_000,
  });
});

/**
 * 노트 full 모드 우측의 공유 챗봇 한 턴을 화면에서 굴린다. 개인 챗봇과 같은 SSE 레이어를
 * 쓰지만 진입점(노트 스코프)과 게이트(회의 ACTIVE)가 달라 별도 증거가 필요하다.
 * `01K0000000002`는 목 기본 시드에서 IN_PROGRESS + 시작자 있음(=ACTIVE)이다.
 */
test("streams a shared chat turn inside a note", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);

  const panel = page.getByRole("complementary", { name: "회의 챗봇" });
  await panel.getByLabel("메시지").fill("이번 회의에서 정한 것만 정리해줘");
  await panel.getByRole("button", { name: "보내기" }).click();

  // 공유 챗봇도 같은 SSE·풀을 쓴다 — 어시스턴트 답변이 실제 문장으로 채워지는지 확인.
  await expect(panel.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );
});

/**
 * 관전자(다른 멤버가 입력 중)는 스트림을 받지 않고 `lock`을 폴링해서만 안다. 목에 남의
 * 잠금을 심고, 폴링이 그것을 잡아 컴포저를 잠그는지 확인한다. 폴링은 문서가 보일 때만 도는데
 * (TanStack 기본) Playwright 탭은 visible이라 도는 게 정상이다.
 */
test("locks the composer when another member is typing", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);

  const panel = page.getByRole("complementary", { name: "회의 챗봇" });
  await panel.getByLabel("메시지").waitFor();

  // 로드 뒤에 심는다 — 새로고침은 목 상태를 초기화하므로 폴링이 잡아야 한다.
  await page.evaluate(() =>
    fetch("/v1/notes/01K0000000002/_mock/foreign-lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ lockedBy: "김민수" }),
    })
  );

  await expect(page.getByText(/김민수님이 입력 중/).first()).toBeVisible({
    timeout: 20_000,
  });
});

/**
 * OAuth는 authorize가 외부로 리다이렉트하는 흐름이라 서비스 워커가 가로챌 수 없다.
 * 목에서는 `/mock-oauth`가 그 자리를 대신하므로, 왕복이 실제로 닫히는지 확인한다.
 */
test("completes the mocked OAuth round trip", async ({ page }) => {
  await page.goto(
    `/mock-oauth?workspaceId=${MOCK_WORKSPACE_ID}&provider=LINEAR`
  );
  await expect(
    page.getByRole("button", { name: "허용하고 돌아가기" })
  ).toBeVisible();

  await page.getByRole("button", { name: "허용하고 돌아가기" }).click();

  // 이동이 끝난 뒤 확인한다 — 이동 중에 평가하면 아직 워커가 붙지 않은 페이지에서 돈다.
  await page.waitForURL(`**/w/${MOCK_WORKSPACE_ID}`);
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);

  await expect
    .poll(async () =>
      page.evaluate(async (workspaceId) => {
        const response = await fetch(
          `/v1/workspaces/${workspaceId}/integrations`,
          { credentials: "include" }
        );
        const body = await response.json();
        return body.data.integrations.find(
          (item: { provider: string }) => item.provider === "LINEAR"
        ).connected;
      }, MOCK_WORKSPACE_ID)
    )
    .toBe(true);
});

/**
 * 스크롤 여백이 실제로 생기는지 본다.
 *
 * jsdom은 레이아웃을 계산하지 않아 단위 테스트로는 못 잡는다. `min-h-0`이 빠지면 flex 아이템의
 * 기본 `min-height: auto` 때문에 뷰포트가 콘텐츠만큼 커져 `scrollHeight === clientHeight`가
 * 되고, 스크롤과 자동 하단 이동이 함께 죽는다.
 */
test("keeps the personal chat scrollable when the thread grows", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();

  const panel = page.getByTestId("personal-chat-panel");
  await expect(panel).toBeVisible();

  // 스크롤할 여백이 생길 만큼 대화를 쌓는다.
  for (let turn = 0; turn < 4; turn += 1) {
    await page.getByLabel("메시지").fill(`스크롤을 만드는 메시지 ${turn}`);
    await page.getByRole("button", { name: "보내기" }).click();
    await expect(page.getByTestId("assistant-message").nth(turn)).toContainText(
      "습니다",
      { timeout: 20_000 }
    );
  }

  const viewport = panel.locator('[data-slot="scroll-area-viewport"]');
  const metrics = () =>
    viewport.evaluate((el) => ({
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
    }));

  const grown = await metrics();
  expect(grown.scrollHeight - grown.clientHeight).toBeGreaterThan(0);

  // 새 출력은 하단으로 따라간다. 바닥까지의 거리가 1px 안이면 따라간 것으로 본다
  // (분수 픽셀 때문에 정확히 0이 아닐 수 있다).
  expect(
    grown.scrollHeight - grown.scrollTop - grown.clientHeight
  ).toBeLessThanOrEqual(1);

  // 위를 읽는 중에는 끌려 내려가지 않는다. 이 분기는 min-h-0 전에는 아예 돌지 못했다 —
  // scrollHeight === clientHeight라 언제나 '바닥'이었기 때문이다.
  await viewport.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll"));
  });

  await page.getByLabel("메시지").fill("위를 읽는 중에 오는 메시지");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByTestId("assistant-message").nth(4)).toContainText(
    "습니다",
    { timeout: 20_000 }
  );

  expect((await metrics()).scrollTop).toBe(0);
});

/**
 * 노트가 열린 상태에서 프로젝트를 고르면 목록으로 돌아가는지 본다.
 *
 * 노트 표면이 본문 컬럼을 덮어서(full은 항상, side는 모바일에서 inset-0) 필터만 바꾸면
 * 화면이 반응하지 않는 것처럼 보였다.
 */
test("returns to the note list when a project is picked in full view", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);
  await expect(page).toHaveURL(/notes/);

  await page.getByRole("button", { name: "모든 노트" }).click();

  await expect(page).toHaveURL(new RegExp(`/w/${MOCK_WORKSPACE_ID}$`));
});
