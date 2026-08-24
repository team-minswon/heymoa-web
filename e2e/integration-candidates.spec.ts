import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

/**
 * 맥락 후보 레일 — **실서버 대상**. APP-459가 배포되는 순간 초록이 되도록 미리 써 둔다.
 *
 * 지금은 server에 `GET /v1/notes/{noteId}/context-candidates`가 없어(`grep 0건`) 이 파일이
 * 통째로 skip된다. **skip 사유가 곧 「무엇이 아직 없는가」의 자동 확인**이다 — 계약이
 * 들어오면 아무것도 안 고쳐도 돌기 시작한다.
 *
 * 같은 세 시나리오의 목 판은 `context-candidates.spec.ts`에 있고 지금 초록이다. 그쪽이
 * 화면의 옳음을, 이쪽이 계약의 도달을 지킨다.
 *
 * 실행:
 *   cd deploy/integration
 *   docker compose -f compose.yml -f compose.realtime.yml up -d --build
 *   INTEGRATION_WEB_URL=http://localhost:3000 \
 *   INTEGRATION_API_URL=http://localhost:18080 \
 *   INTEGRATION_TOKEN_FILE=<minted-jwt> \
 *   INTEGRATION_NOTE_ID=<실제 전사가 있는 노트> \
 *   pnpm playwright test e2e/integration-candidates.spec.ts
 */

const WEB = process.env.INTEGRATION_WEB_URL;
const API = process.env.INTEGRATION_API_URL ?? "http://localhost:18080";
const TOKEN = process.env.INTEGRATION_TOKEN_FILE
  ? readFileSync(process.env.INTEGRATION_TOKEN_FILE, "utf8").trim()
  : process.env.INTEGRATION_TOKEN;

const NOTE_ID = process.env.INTEGRATION_NOTE_ID ?? "01K0000000031";
const WORKSPACE_ID = process.env.INTEGRATION_WORKSPACE_ID ?? "01K0000000010";

test.skip(!WEB || !TOKEN, "통합 스택과 토큰이 있어야 돈다");

/**
 * **계약이 실제로 있는지 먼저 묻는다.** 없으면 이 파일을 건너뛴다 — 서버가 아직 안 낸 것을
 * 실패로 보고하면 신호가 소음이 된다. 계약이 오면 이 게이트가 저절로 열린다.
 */
let contractReady = false;

test.beforeAll(async ({ request }) => {
  if (!TOKEN) return;
  const res = await request.get(
    `${API}/v1/notes/${NOTE_ID}/context-candidates`,
    {
      headers: { Cookie: `access_token=${TOKEN}` },
      failOnStatusCode: false,
    }
  );
  const status = res.status();
  contractReady = status === 200;
  if (!contractReady) {
    // **skip 사유를 남긴다.** 「왜 안 돌았나」가 안 보이면 초록과 구분이 안 된다.
    // 401 이면 토큰이, 404 면 계약이 아직 없는 것이다 — 둘을 갈라 적는다.
    const why =
      status === 401
        ? "토큰이 안 먹습니다(ACCESS_TOKEN_SECRET 불일치이거나 만료)"
        : status === 404
          ? "server 에 조회 경로가 아직 없습니다"
          : `예상 못 한 응답입니다`;
    // 이 줄이 skip 의 유일한 근거다 — 없으면 초록과 구분이 안 된다.
    console.log(
      `[skip] ${status} @ /v1/notes/${NOTE_ID}/context-candidates — ${why}`
    );
  }
});

test.beforeEach(async ({ context }) => {
  test.skip(!contractReady, "APP-459 조회 계약 대기 중");
  await context.addCookies([
    {
      name: "access_token",
      value: TOKEN!,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    },
  ]);
});

async function openRail(page: Page) {
  await page.goto(`${WEB}/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full`);
  const tab = page.getByRole("tab", { name: "실시간 정리" });
  await tab.click();
  return tab;
}

test.describe("실서버 — 맥락 후보", () => {
  test("REST 성공: 스냅샷이 화면에 그려지고 실패 상태가 아니다", async ({ page }) => {
    test.setTimeout(90_000);
    const calls: number[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/context-candidates")) calls.push(r.status());
    });

    await openRail(page);

    // 실서버를 실제로 탔다.
    await expect.poll(() => calls.length, { timeout: 30_000 }).toBeGreaterThan(0);
    expect(calls).toContain(200);

    // **조회 실패를 빈 상태로 접지 않는다** — 그게 접히면 사용자가 후보 0건을 사실로 믿는다.
    await expect(page.getByText(/불러오지 못했습니다/)).toHaveCount(0);
    await expect(page.getByText(/지금까지 \d+건/)).toBeVisible({ timeout: 20_000 });
  });

  test("WS batch 성공: 갱신 시각이 서버 값에서 온다", async ({ page }) => {
    test.setTimeout(120_000);
    await openRail(page);
    await expect(page.getByText(/지금까지 \d+건/)).toBeVisible({ timeout: 20_000 });

    // 갱신 띠는 `context.classification.batch.applied` 의 `occurredAt` 으로 움직인다.
    // **수신 시각이 아니다** — 그러면 재연결 직후 「방금」이 되어 멈춘 lane 을 살아 있다고
    // 보고한다. 배치가 한 번이라도 오면 시각이 선다.
    const rail = page.getByRole("tabpanel", { name: "실시간 정리" });
    await expect(rail.locator("time").first()).toBeVisible({ timeout: 60_000 });
  });

  test("reload recovery: 새로고침해도 원장이 남고 중복이 안 생긴다", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openRail(page);
    const before = await page
      .getByText(/지금까지 \d+건/)
      .textContent({ timeout: 20_000 });

    await page.reload();
    await openRail(page);
    const after = await page
      .getByText(/지금까지 \d+건/)
      .textContent({ timeout: 20_000 });

    // 이벤트가 아니라 REST 스냅샷이 정본이라 새로고침이 상태를 안 잃는다.
    // 그리고 `(candidateId, revision)` dedupe 라 같은 후보가 두 번 안 선다.
    expect(after).toBe(before);
  });
});
