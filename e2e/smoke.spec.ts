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
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
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
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
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
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  const events = await page.evaluate(async () => {
    const created = await fetch("/v1/agent-chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ scope: "workspace", workspaceId: "01K0000000000" }),
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

  await expect(
    page.getByText("회의에서 정한 내용을 정리했습니다.")
  ).toBeVisible({ timeout: 20_000 });
});

/**
 * 회의 종료 → 분석 대기 흐름을 화면에서 굴린다. 시작자 조작(회의 종료)·확인 다이얼로그·
 * 종료 후 요약 탭이 분석 진행으로 넘어가는지 서비스 워커 경로로 확인한다.
 * `01K0000000002`는 시작자가 목 유저라 조작 버튼이 뜬다.
 */
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
  await page.getByRole("button", { name: "논의된 이슈를 Linear 이슈로 만들어줘" }).click();

  // 승인 카드가 뜨고 300초 상한 문구가 있다.
  await expect(page.getByText(/5분 뒤 자동으로 거절/)).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "승인" }).click();

  // 승인 → 실행 기록(외부 링크 포함)이 남는다.
  await expect(page.getByText("APP-12 생성됨")).toBeVisible({ timeout: 20_000 });
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

  await expect(
    page.getByText("회의에서 정한 내용을 정리했습니다.")
  ).toBeVisible({ timeout: 20_000 });
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
  await page.goto(`/mock-oauth?workspaceId=${MOCK_WORKSPACE_ID}&provider=LINEAR`);
  await expect(page.getByRole("button", { name: "허용하고 돌아가기" })).toBeVisible();

  await page.getByRole("button", { name: "허용하고 돌아가기" }).click();

  // 이동이 끝난 뒤 확인한다 — 이동 중에 평가하면 아직 워커가 붙지 않은 페이지에서 돈다.
  await page.waitForURL(`**/w/${MOCK_WORKSPACE_ID}`);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
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
