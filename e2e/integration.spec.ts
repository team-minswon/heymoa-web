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

    await page.goto(`${WEB}/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full&tab=transcript`, {
      waitUntil: "networkidle",
    });

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

  test("후보 조회가 실패하면 빈 상태가 아니라 재시도를 보인다", async ({ page }) => {
    test.setTimeout(90_000);
    // APP-459 미구현이면 `/context-candidates` 가 404 다. **그걸 「사건 없음」으로 접으면
    // 사용자가 후보 0건을 사실로 믿는다.** 실패는 실패로 그리고, 전사는 그대로 돌아야 한다.
    await page.goto(`${WEB}/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full&tab=transcript`, {
      waitUntil: "networkidle",
    });

    const railTab = page.getByRole("tab", { name: "실시간 정리" });
    await expect(railTab).toBeVisible({ timeout: 30_000 });
    await railTab.click();

    await expect(page.getByText(/불러오지 못했습니다/)).toBeVisible();
    await expect(page.getByText(/아직 정리할 발화가 없습니다/)).toHaveCount(0);

    // 전사는 살아 있다.
    await page.getByRole("tab", { name: "전사" }).click();
    await expect(
      page.getByText("경로 데이터 저장소는 MongoDB로 갑시다")
    ).toBeVisible();
  });
});
