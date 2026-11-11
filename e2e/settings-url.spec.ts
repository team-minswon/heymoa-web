import { expect, test, type Page } from "@playwright/test";

/**
 * 설정 창이 주소(`?settings=`)에 남는다(APP-1211). 열기 = push, 탭 바꾸기 = replace, 뒤로 가기 한 번에 닫힘.
 * 라우터를 안 거치므로 `_rsc=` 왕복도 없어야 한다.
 */
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

  // 열기·탭 바꾸기는 라우터를 안 거친다 — RSC 왕복 0건
  expect(rsc).toEqual([]);

  await page.reload();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "연동" })).toHaveAttribute(
    "aria-current",
    "page"
  );

  // 새로고침 뒤에도 한 번으로 닫힌다 — 탭 두 번은 기록을 쌓지 않았다
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
  // 닫기는 열 때 쌓은 항목을 걷는다 — 뒤로 가면 사이트를 나가지 않고 워크스페이스 이전 자리다
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
  // 구매는 전용 화면으로 가지 않고 같은 탭 안의 주문 확인으로 바뀐다.
  await page.getByRole("button", { name: "Pro 시작하기" }).click();
  await expect(
    dialog(page).getByRole("heading", { name: "주문 확인" })
  ).toBeVisible();
  await expect.poll(() => search(page)).toBe("?settings=billing");

  await page.goto(`${WS}?settings=payment`);
  await expect(page.getByRole("button", { name: "결제 관리" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    dialog(page).getByRole("region", { name: "결제 내역" })
  ).toBeVisible();
});
