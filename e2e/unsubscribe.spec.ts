import { expect, test } from "@playwright/test";

test("토큰이 Referer 로 새지 않게 응답 헤더를 붙인다", async ({ request }) => {
  const response = await request.get("/unsubscribe?t=e2e");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
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

test("영어 선택은 메일 링크에서도 유지되고 토큰 referrer 보호는 그대로다", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-US" });
  await context.addCookies([{ name: "heymoa-lang", value: "en", domain: "localhost", path: "/" }]);
  const page = await context.newPage();
  const response = await page.goto("http://localhost:3100/unsubscribe?t=invalid");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "This link isn't valid" })).toBeVisible();
  expect(response!.headers()["referrer-policy"]).toBe("no-referrer");
  await context.close();
});
