import { expect, test } from "@playwright/test";

/**
 * 로그인하지 않은 채 메일의 노트 링크를 열면 로그인 뒤 **같은 노트·탭**으로 돌아와야 한다(APP-1312). 예전에는
 * 워크스페이스 조회가 401 로 끝나 「다시 시도」만 섰다.
 */
const NOTE_PATH = "/w/01K0000000000/notes/01K0000000040";
const MAIL_QUERY =
  "view=full&tab=transcript&utm_source=heymoa&utm_medium=email&utm_campaign=meeting_paused_reminder";

test("로그인 안 한 채 연 메일 링크는 로그인 카드를 세우고 주소를 그대로 둔다", async ({
  page,
}) => {
  await page.route("**/v1/auth/session", (route) =>
    route.fulfill({
      json: { success: true, data: { state: "anonymous" }, error: null },
    })
  );
  await page.goto(`${NOTE_PATH}?${MAIL_QUERY}`);
  // 「워크스페이스를 불러오지 못했습니다 · 다시 시도」만 서던 자리에 로그인 카드가 선다.
  await expect(
    page.getByRole("heading", { name: "로그인하면 이 화면으로 돌아옵니다" })
  ).toBeVisible();
  // 돌아올 자리는 누르는 순간의 주소(쿼리째)다 — `normalizeReturnTo` 가 메일 링크를 그대로 통과시키는지는
  // `lib/auth/paths.test.ts` 가 본다. 이 환경은 서버 인가 입구가 없어 버튼이 서 있는 데까지만 본다.
  await expect(
    page.getByRole("button", { name: "Google로 로그인" })
  ).toBeVisible();
  await expect(page).toHaveURL(`${NOTE_PATH}?${MAIL_QUERY}`);
});
