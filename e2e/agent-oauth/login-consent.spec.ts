import { expect, test, type Page } from "@playwright/test";

/**
 * 로그인 약관 동의(APP-1277). 로그인 창의 체크박스, Google 왕복, 돌아온 `/auth/callback` 의 동의 기록을 브라우저로
 * 본다. 가짜 API 가 server 의 Google 로그인 왕복과 동의 API(`POST /v1/users/me/consents`)를 흉내 내고, 시험은
 * `/__test/account` 로 계정의 동의 상태를 정한다.
 */
const API = `http://localhost:${process.env.E2E_API_PORT ?? "3199"}`;
const WORKSPACE = "/w/01K0000000001";

type FakeLog = {
  google: number;
  consentAttempts: number;
  consents: { consents: { documentType: string; version: string }[] }[];
};

async function fakeLog(page: Page): Promise<FakeLog> {
  return (await page.request.get(`${API}/__test/state`)).json();
}

async function setAccount(
  page: Page,
  account: { consentRequired?: boolean; version?: string; failRecords?: number }
) {
  await page.request.post(`${API}/__test/account`, { data: account });
}

/** 랜딩 머리글의 시작 버튼으로 로그인 창을 연다. */
async function openLoginModal(
  page: Page,
  path = "/",
  opener = "무료로 시작하기"
) {
  await page.goto(path);
  await page.getByRole("button", { name: opener, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

/** 체크하고 Google 로 로그인한다. 가짜 API 가 쿠키를 심고 callback 으로 돌려보낸다. */
async function agreeAndLogin(dialog: ReturnType<Page["getByRole"]>) {
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Google로 로그인" }).click();
}

const recordedVersions = (log: FakeLog) =>
  log.consents.map(({ consents }) =>
    consents.map(({ documentType, version }) => `${documentType}@${version}`)
  );

test.beforeEach(async ({ page }) => {
  await page.request.post(`${API}/__test/reset`);
});

test("체크하기 전에는 Google 로그인이 시작되지 않고, 누르면 높이 변화 없이 체크박스로 보낸다", async ({
  page,
}) => {
  const dialog = await openLoginModal(page);
  const google = dialog.getByRole("button", { name: "Google로 로그인" });
  const agreement = dialog.getByRole("checkbox");
  // 레이아웃 높이다. 창이 열리며 커지는 transform 은 빼고 본다.
  const height = () =>
    dialog.evaluate((element) => (element as HTMLElement).offsetHeight);

  // 흐리게만 보이고 클릭은 받는다. 이유 문장은 스크린리더에만 있다(APP-1402).
  await expect(google).toHaveAttribute("aria-disabled", "true");
  await expect(google).toHaveAccessibleDescription(
    "동의해야 로그인할 수 있습니다."
  );
  const before = await height();

  // Playwright 는 aria-disabled 버튼을 「누를 수 없음」으로 보고 기다린다. 실제 브라우저에서는 눌린다.
  await google.click({ force: true });
  await expect(agreement).toBeFocused();
  await expect(dialog.getByRole("status")).toHaveText(
    "동의해야 로그인할 수 있습니다."
  );
  await expect(page).toHaveURL("/");
  expect((await fakeLog(page)).google).toBe(0);
  expect(await height()).toBe(before);

  // 체크하면 열리고, 풀면 다시 막힌다. 어느 쪽이든 창 높이는 그대로다.
  await agreement.check();
  await expect(google).not.toHaveAttribute("aria-disabled");
  expect(await height()).toBe(before);
  await agreement.uncheck();
  await expect(google).toHaveAttribute("aria-disabled", "true");
});

test("문서 이름은 각 문서로 가는 링크이고 체크박스의 이름에 들어 있다", async ({
  page,
}) => {
  const dialog = await openLoginModal(page);

  await expect(
    dialog.getByRole("checkbox", {
      name: "개인정보 처리방침과 이용약관을 읽었으며 이에 동의합니다",
    })
  ).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "개인정보 처리방침" })
  ).toHaveAttribute("href", "/privacy");
  await expect(dialog.getByRole("link", { name: "이용약관" })).toHaveAttribute(
    "href",
    "/terms"
  );
  // 문구가 줄 끝에서 낱말 중간으로 갈라지지 않는다 — 한 줄이거나 낱말 단위로만 줄을 바꾼다.
  const wordBreak = await dialog
    .getByRole("checkbox")
    .locator("xpath=ancestor::label//span[last()]")
    .evaluate((element) => getComputedStyle(element).wordBreak);
  expect(wordBreak).toBe("keep-all");
});

test("신규 가입은 체크하고 로그인하면 동의 기록이 서버에 생기고 대시보드로 간다", async ({
  page,
}) => {
  await setAccount(page, { consentRequired: true });

  await agreeAndLogin(await openLoginModal(page));

  await expect(page).toHaveURL(WORKSPACE);
  const log = await fakeLog(page);
  expect(log.google).toBe(1);
  expect(recordedVersions(log)).toEqual([
    ["PRIVACY@2026-10-22", "TERMS@2026-10-22"],
  ]);
});

test("이미 동의한 기존 사용자도 같은 체크박스를 거치지만 다시 기록하지 않는다", async ({
  page,
}) => {
  await agreeAndLogin(await openLoginModal(page));

  await expect(page).toHaveURL(WORKSPACE);
  const log = await fakeLog(page);
  expect(log.google).toBe(1);
  expect(log.consentAttempts).toBe(0);
});

test("문서 버전이 올라간 뒤 처음 로그인하는 기존 사용자는 서버의 새 버전으로 동의한다", async ({
  page,
}) => {
  await setAccount(page, { consentRequired: true, version: "2027-01-02" });

  await agreeAndLogin(await openLoginModal(page));

  await expect(page).toHaveURL(WORKSPACE);
  expect(recordedVersions(await fakeLog(page))).toEqual([
    ["PRIVACY@2027-01-02", "TERMS@2027-01-02"],
  ]);
});

test("기록이 실패하면 대시보드에 들어가기 전에 다시 시도하게 한다", async ({
  page,
}) => {
  await setAccount(page, { consentRequired: true, failRecords: 1 });

  await agreeAndLogin(await openLoginModal(page));

  await expect(
    page.getByRole("heading", { name: "동의를 기록하지 못했습니다" })
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/callback/);
  expect((await fakeLog(page)).consents).toEqual([]);

  await page.getByRole("button", { name: "다시 시도" }).click();

  await expect(page).toHaveURL(WORKSPACE);
  const log = await fakeLog(page);
  expect(log.consentAttempts).toBe(2);
  expect(recordedVersions(log)).toEqual([
    ["PRIVACY@2026-10-22", "TERMS@2026-10-22"],
  ]);
});

test("로그인 창을 거치지 않은 로그인은 동의를 기록하지 않고 체크박스를 한 번 더 받는다", async ({
  page,
}) => {
  await setAccount(page, { consentRequired: true });

  // 초대 링크·외부 에이전트 로그인처럼 창의 체크를 거치지 않고 Google 왕복만 한 경우.
  await page.goto(`${API}/v1/auth/oauth2/authorize/google?returnTo=%2F`);

  await expect(
    page.getByRole("heading", { name: "약관에 동의해 주세요" })
  ).toBeVisible();
  const agree = page.getByRole("button", { name: "동의하고 계속" });
  await expect(agree).toHaveAttribute("aria-disabled", "true");
  await agree.click({ force: true });
  await expect(page.getByRole("checkbox")).toBeFocused();
  await expect(page.getByRole("status")).toHaveText(
    "동의해야 계속할 수 있습니다."
  );
  expect((await fakeLog(page)).consentAttempts).toBe(0);
  await expect(page).toHaveURL(/\/auth\/callback/);

  await page.getByRole("checkbox").check();
  await agree.click();

  await expect(page).toHaveURL(WORKSPACE);
  expect(recordedVersions(await fakeLog(page))).toEqual([
    ["PRIVACY@2026-10-22", "TERMS@2026-10-22"],
  ]);
});

test("영어판 로그인 창은 영어 문구와 /en 문서 링크를 쓴다", async ({
  page,
}) => {
  const dialog = await openLoginModal(page, "/en", "Get started free");
  const google = dialog.getByRole("button", { name: "Sign in with Google" });

  await expect(google).toHaveAttribute("aria-disabled", "true");
  await expect(google).toHaveAccessibleDescription(
    "You need to agree before you can sign in."
  );
  await expect(
    dialog.getByRole("checkbox", {
      name: "I have read and agree to the Privacy Policy and the Terms of Service",
    })
  ).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Privacy Policy" })
  ).toHaveAttribute("href", "/en/privacy");
  await expect(
    dialog.getByRole("link", { name: "Terms of Service" })
  ).toHaveAttribute("href", "/en/terms");

  await dialog.getByRole("checkbox").check();
  await expect(google).not.toHaveAttribute("aria-disabled");
});
