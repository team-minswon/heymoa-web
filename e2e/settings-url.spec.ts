import { expect, test, type Page } from "@playwright/test";

const WS = "/w/01K0000000000";
const dialog = (page: Page) => page.getByRole("dialog", { name: "설정" });
const search = (page: Page) => new URL(page.url()).search;

async function openFromSidebar(page: Page) {
  await page.getByRole("button", { name: /테스트 유저/ }).click();
  await page.getByRole("menuitem", { name: "내 계정 설정" }).click();
}

test("열면 주소에 남고, 탭은 기록을 안 쌓아 뒤로 가기 한 번에 닫히며, 새로고침하면 유지된다", async ({
  page,
}) => {
  const rsc: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === WS &&
      url.searchParams.has("_rsc") &&
      request.headers()["next-router-prefetch"] !== "1"
    )
      rsc.push(request.url());
  });
  await page.goto(WS);
  await openFromSidebar(page);
  await expect(dialog(page)).toBeVisible();
  expect(search(page)).toBe("?settings=account");

  await page.getByRole("button", { name: "멤버" }).click();
  await page.getByRole("button", { name: "연동" }).click();
  expect(search(page)).toBe("?settings=integrations");

  expect(rsc).toEqual([]);

  await page.reload();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "연동" })).toHaveAttribute(
    "aria-current",
    "page"
  );

  await page.goBack();
  await expect(dialog(page)).toBeHidden();
  expect(search(page)).toBe("");
  await page.goForward();
  await expect(dialog(page)).toBeVisible();
});

test("X 로 닫으면 기록이 늘지 않고, 딥링크·잘못된 값·다른 쿼리와의 병합이 맞다", async ({
  page,
}) => {
  await page.goto(WS);
  await openFromSidebar(page);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  expect(search(page)).toBe("");
  expect(await page.evaluate(() => window.history.length)).toBeGreaterThan(0);

  await page.goto(`${WS}?settings=members&keep=1`);
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "멤버" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  expect(search(page)).toBe("?keep=1");

  await page.goto(`${WS}?settings=nope`);
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "일반" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect.poll(() => search(page)).toBe("?settings=workspace");
});

test("OAuth 복귀는 연동 탭을 열고 provider·status 를 걷는다", async ({
  page,
}) => {
  await page.goto(`${WS}?provider=LINEAR&status=connected`);
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "연동" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect.poll(() => search(page)).toBe("?settings=integrations");
});

test("?settings=billing 은 요금제 탭을, ?settings=payment 는 결제 관리 탭을 연다", async ({
  page,
}) => {
  await page.goto(`${WS}?settings=billing`);
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "요금제" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await page.getByRole("button", { name: "Pro 시작하기" }).click();
  await expect(page).toHaveURL(/\/billing\/checkout\/[0-9A-Z]{13}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "주문 확인" })
  ).toBeVisible();

  await page.goto(`${WS}?settings=payment`);
  await expect(page.getByRole("button", { name: "결제 관리" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    dialog(page).getByRole("region", { name: "결제 내역" })
  ).toBeVisible();
});
