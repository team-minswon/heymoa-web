import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

/**
 * **통합 스택 대상 E2E.** MSW 목이 아니라 실제 heymoa-server 를 탄다.
 *
 * 기본 e2e(`smoke.spec.ts`)와 다른 파일인 이유는 전제가 다르기 때문이다 — 저쪽은
 * `pnpm dev` + MSW 이고 이쪽은 `deploy/integration/compose.yml` 로 띄운 컨테이너다.
 * 스택이 없으면 이 파일은 통째로 skip 된다.
 *
 * 실행:
 *   cd deploy/integration && docker compose up -d --build
 *   INTEGRATION_WEB_URL=http://localhost:3000 \
 *   INTEGRATION_TOKEN=<minted> \
 *   pnpm playwright test e2e/integration.spec.ts
 */

const WEB = process.env.INTEGRATION_WEB_URL;
const API = process.env.INTEGRATION_API_URL ?? "http://localhost:18080";
const TOKEN =
  process.env.INTEGRATION_TOKEN ??
  (process.env.INTEGRATION_TOKEN_FILE
    ? readFileSync(process.env.INTEGRATION_TOKEN_FILE, "utf8").trim()
    : undefined);

const NOTE_ID = process.env.INTEGRATION_NOTE_ID ?? "01K0000000030";
const WORKSPACE_ID = process.env.INTEGRATION_WORKSPACE_ID ?? "01K0000000010";

test.skip(!WEB || !TOKEN, "통합 스택과 토큰이 있어야 돈다");

test.describe("통합 스택 — 실서버", () => {
  test.beforeEach(async ({ context }) => {
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

  test("실서버 데이터로 노트와 전사가 그려진다", async ({ page }) => {
    test.setTimeout(90_000);
    const apiCalls: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/v1/")) apiCalls.push(r.url());
    });

    await page.goto(
      `${WEB}/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full&tab=transcript`,
      {
        waitUntil: "networkidle",
      }
    );

    // **MSW 가 아니라 실서버를 탔다는 증거.**
    expect(apiCalls.some((u) => u.includes("/v1/notes/"))).toBe(true);

    // DB 에 심은 발화가 화면에 온다.
    await expect(
      page.getByText("경로 데이터 저장소는 MongoDB로 갑시다")
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText("장애 대응 runbook이 비어 있는 것도 따로 봐야 합니다")
    ).toBeVisible();
  });

  test("후보 조회가 성공해도 전사와 회의 경로가 그대로 산다", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    // **이 테스트는 한 번 뒤집혔다.** APP-459 미구현 시절에는 `/context-candidates` 가
    // 404 라서 「실패를 빈 상태로 접지 않는가」를 봤다. 이제 그 경로가 서므로 같은 기대를
    // 두면 실패한다 — 무엇을 지키는지는 그대로고(전사와 회의는 레일과 독립이다) 전제만
    // 성공으로 바뀐다. 실패 쪽 회귀는 MSW 판(`context-candidates.spec.ts`)이 계속 지킨다.
    // 후보 조회는 Next SSR에서 먼저 실행될 수 있어 브라우저 response 이벤트만으로
    // 실서버 도달을 증명하면 안 된다. 동일한 인증 쿠키로 API 계약을 직접 확인한다.
    const candidates = await request.get(
      `${API}/v1/notes/${NOTE_ID}/context-candidates`,
      {
        headers: { Cookie: `access_token=${TOKEN}` },
        failOnStatusCode: false,
      }
    );
    expect(candidates.status()).toBe(200);

    await page.goto(
      `${WEB}/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full&tab=transcript`,
      {
        waitUntil: "networkidle",
      }
    );

    const railTab = page.getByRole("tab", { name: "실시간 정리" });
    await expect(railTab).toBeVisible({ timeout: 30_000 });
    await railTab.click();

    // 레일이 정상 표면으로 선다. 「지금까지 N건」은 0건이어도 그려진다 —
    // **실패 배너가 없다는 것**이 이 테스트의 판정이다.
    await expect(page.getByText(/지금까지 \d+건/)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/불러오지 못했습니다/)).toHaveCount(0);

    // 전사는 살아 있다.
    await page.getByRole("tab", { name: "전사" }).click();
    await expect(
      page.getByText("경로 데이터 저장소는 MongoDB로 갑시다")
    ).toBeVisible();

    // 회의 경로도 살아 있다 — 레일은 부가 표면이지 회의의 전제가 아니다.
    const endMeeting = page.getByRole("button", { name: "회의 종료" });
    const noteMenu = page.getByRole("button", { name: /노트 메뉴|더보기/ });
    expect(
      (await endMeeting.count()) + (await noteMenu.count())
    ).toBeGreaterThan(0);
  });
});
