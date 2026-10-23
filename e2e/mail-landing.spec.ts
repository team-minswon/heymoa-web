import { expect, test } from "@playwright/test";

/**
 * 리마인더 메일의 「회의 열기」로 도착한 사람(APP-1312, PRO-67 userflow). 메일은 과거의 일시정지를 말하므로 노트는
 * **도착한 시점의 상태**를 말해야 한다. 서버는 메일의 앱 링크에 `utm_medium=email` 을 붙인다.
 */

const WORKSPACE_ID = "01K0000000000";
/** 녹음한 세션이 있는 일시정지 노트(`lib/mocks/db.ts` 커버리지 추종 확인). */
const PAUSED_NOTE_ID = "01K0000000008";
/** 화자 분리까지 끝난 종료 노트. */
const ENDED_NOTE_ID = "01K0000000020";
const MAIL =
  "utm_source=heymoa&utm_medium=email&utm_campaign=meeting_paused_reminder";

test("여전히 일시정지된 회의는 일시정지 기간과 할 수 있는 일을 말한다", async ({
  page,
}) => {
  await page.goto(`/w/${WORKSPACE_ID}/notes/${PAUSED_NOTE_ID}?${MAIL}`);

  await expect(page.getByTestId("note-status-band")).toHaveText(
    /일시정지 상태입니다\. 이어서 녹음하거나 종료할 수 있습니다\./
  );
  // 띠는 안내만 한다 — 종료는 상단바 「회의 종료」가 한다.
  await expect(page.getByRole("button", { name: "회의 종료" })).toBeVisible();
});

test("그새 끝난 회의는 요약 탭으로 보내고 종료되었다고 말한다", async ({
  page,
}) => {
  await page.goto(`/w/${WORKSPACE_ID}/notes/${ENDED_NOTE_ID}?${MAIL}`);

  await expect(page.getByTestId("note-status-band")).toHaveText(
    "메일을 보낸 뒤 회의가 종료되었습니다."
  );
  await expect(page.getByRole("tab", { name: "요약" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page).toHaveURL(/tab=summary/);
  // 메일 출처는 주소에 그대로 남는다(로그인 복귀·공유가 같은 주소를 쓴다).
  await expect(page).toHaveURL(/utm_medium=email/);
});

test("지운 노트는 다시 시도 대신 열 수 없다고 말하고 목록으로 가는 길을 둔다", async ({
  page,
}) => {
  await page.goto(`/w/${WORKSPACE_ID}/notes/01K00000000ZZ?${MAIL}`);

  await expect(
    page.getByRole("alert").filter({ hasText: "이 회의를 열 수 없습니다" })
  ).toBeVisible();
  await page.getByRole("button", { name: "노트 목록으로" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_ID}$`));
});
