import { expect, test } from "@playwright/test";

const user = {
  userId: "01K0000000000",
  name: "사용자",
  email: "user@example.com",
  image: null,
};

test("느린 로그아웃 요청 중 대기를 표시하고 성공하면 익명 홈으로 이동한다", async ({
  page,
}) => {
  let authenticated = true;
  let logoutRequests = 0;
  let completeLogout!: () => void;
  const logoutResponse = new Promise<void>((resolve) => {
    completeLogout = resolve;
  });
  await page.route("**/v1/auth/session", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: authenticated
          ? { state: "authenticated", user }
          : { state: "anonymous" },
        error: null,
      },
    })
  );
  await page.route("**/v1/auth/logout", async (route) => {
    logoutRequests += 1;
    await logoutResponse;
    authenticated = false;
    await route.fulfill({ status: 204 });
  });
  await page.goto("/terms");
  const logout = page.getByRole("button", { name: "로그아웃", exact: true });
  await logout.click();
  try {
    await expect(logout).toBeDisabled();
    await expect(logout).toHaveAttribute("aria-busy", "true");
    expect(logoutRequests).toBe(1);
  } finally {
    completeLogout();
  }
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", { name: "로그인", exact: true })
  ).toBeVisible();
});

test("SSR 사용자가 없는 첫 익명 방문은 세션만 읽고 refresh를 보내지 않는다", async ({
  page,
}) => {
  let reads = 0;
  let refreshes = 0;
  await page.route("**/v1/auth/session", async (route) => {
    reads += 1;
    await route.fulfill({
      json: { success: true, data: { state: "anonymous" }, error: null },
    });
  });
  await page.route("**/v1/auth/refresh", async (route) => {
    refreshes += 1;
    await route.fulfill({ status: 401, json: { success: false } });
  });
  await page.goto("/terms");
  await expect(
    page.getByRole("button", { name: "로그인", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "로그인 상태 확인 중" })
  ).toHaveCount(0);
  expect(reads).toBe(1);
  expect(refreshes).toBe(0);
});

test("SSR 사용자가 없어도 브라우저 갱신 후보는 한 번 복구하고 로그인된다", async ({
  page,
}) => {
  let reads = 0;
  let refreshes = 0;
  await page.route("**/v1/auth/session", async (route) => {
    reads += 1;
    await route.fulfill({
      json: {
        success: true,
        data: refreshes
          ? { state: "authenticated", user }
          : { state: "refresh_required" },
        error: null,
      },
    });
  });
  await page.route("**/v1/auth/refresh", async (route) => {
    refreshes += 1;
    expect(route.request().method()).toBe("POST");
    await route.fulfill({
      json: { success: true, data: { message: "refreshed" }, error: null },
    });
  });
  await page.route("**/v1/workspaces", (route) =>
    route.fulfill({
      json: { success: true, data: { workspaces: [] }, error: null },
    })
  );
  await page.goto("/terms");
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true })
  ).toBeVisible();
  expect(reads).toBe(2);
  expect(refreshes).toBe(1);
});

test("invalid refresh는 한 번 실패한 뒤 익명이며 만료 toast나 logout 요청이 없다", async ({
  page,
}) => {
  let refreshes = 0;
  let logouts = 0;
  await page.route("**/v1/auth/session", (route) =>
    route.fulfill({
      json: { success: true, data: { state: "refresh_required" }, error: null },
    })
  );
  await page.route("**/v1/auth/refresh", async (route) => {
    refreshes += 1;
    await route.fulfill({
      status: 401,
      json: {
        success: false,
        data: null,
        error: { code: "INVALID_REFRESH_TOKEN", message: "invalid" },
      },
    });
  });
  await page.route("**/v1/auth/logout", async (route) => {
    logouts += 1;
    await route.fulfill({ json: { success: true } });
  });
  await page.goto("/terms");
  await expect(
    page.getByRole("button", { name: "로그인", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "로그인 상태 확인 중" })
  ).toHaveCount(0);
  expect(refreshes).toBe(1);
  expect(logouts).toBe(0);
  await expect(
    page.getByText("세션이 만료되었습니다. 다시 로그인해 주세요.")
  ).toHaveCount(0);
});
