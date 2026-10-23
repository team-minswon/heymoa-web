import { expect, test } from "@playwright/test";

/**
 * 메일 푸터의 수신거부 링크가 여는 화면(APP-1314, PRO-67 userflow 「수신거부」). 목 서버는 토큰 `invalid` 를
 * 서명이 맞지 않는 링크로, 나머지를 맞는 링크로 본다(`lib/mocks/rest-handlers.ts`).
 */

test("토큰이 Referer 로 새지 않게 응답 헤더를 붙인다", async ({ request }) => {
  const response = await request.get("/unsubscribe?t=e2e");
  // `Cache-Control: no-store` 도 같은 설정(`next.config.ts`)이 붙이지만 개발 서버는 페이지 응답의 Cache-Control 을
  // 제 값으로 덮는다. 그 줄은 `next start` 에서 확인했다.
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  // 분석 스크립트는 운영(`VERCEL_ENV=production`)에서만 실리므로 여기서는 볼 수 없다. 이 화면의 루트 레이아웃이
  // 분석을 끈다(`app/(mail)/layout.tsx`). `next start` 에 그 값을 주고 GA·PostHog 가 이 화면에만 없음을 확인했다.
});

test("열기만 하면 GET 만 나가고, 메일 끄기를 눌러야 POST 하고 완료를 보인다", async ({
  page,
}) => {
  const methods: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/v1/mail/unsubscribe"))
      methods.push(request.method());
  });
  await page.goto("/unsubscribe?t=e2e");

  await expect(
    page.getByRole("heading", { name: "일시정지된 회의 메일을 받지 않을까요?" })
  ).toBeVisible();
  await expect(page.getByText("mo***@heymoa.app")).toBeVisible();
  // 개발 서버의 StrictMode·서비스 워커 경유로 GET 이 두 번 잡힐 수 있다. 세는 것은 POST 다.
  expect(methods).not.toContain("POST");

  await page.getByRole("button", { name: "메일 끄기" }).click();
  await expect(
    page.getByRole("heading", { name: "일시정지된 회의 메일을 껐습니다" })
  ).toBeVisible();
  expect(methods.filter((method) => method === "POST")).toHaveLength(1);
});

test("서명이 맞지 않는 링크는 유효하지 않다고 말한다", async ({ page }) => {
  await page.goto("/unsubscribe?t=invalid");
  await expect(
    page.getByRole("heading", { name: "유효하지 않은 링크입니다" })
  ).toBeVisible();
});
