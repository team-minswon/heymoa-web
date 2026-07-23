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
