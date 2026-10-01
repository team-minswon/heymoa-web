import { expect, test, type Page } from "@playwright/test";

/**
 * 외부 에이전트가 돌려주는 두 주소(APP-802). 주소 모양은 server 의 화면 열기 도구(APP-806)와
 * 같다 — 한쪽만 바꾸면 에이전트가 준 링크가 목적 화면에 닿지 않는다.
 */

const MOCK_WORKSPACE_ID = "01K0000000000";
/** 목 워크스페이스의 첫 프로젝트 「주간」(`lib/mocks/db.ts`). */
const PROJECT_ID = "01K0000000001";
/** 화자 분리까지 끝난 종료 노트. 전사가 아카이브로 그려진다(`lib/mocks/db.ts`). */
const ENDED_NOTE_ID = "01K0000000020";

async function serviceWorkerReady(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);
}

async function noteIds(page: Page, projectId: string): Promise<string[]> {
  return page.evaluate(async (id) => {
    const response = await fetch(`/v1/projects/${id}/notes`, {
      credentials: "include",
    });
    const body = await response.json();
    return body.data.notes.map((note: { noteId: string }) => note.noteId);
  }, projectId);
}

test("발화 주소로 들어오면 그 발화가 화면에 보이고 주소에서는 걷힌다", async ({
  page,
}) => {
  await page.goto("/");
  await serviceWorkerReady(page);
  // 첫 줄이 아니라 끝 줄을 고른다 — 첫 줄은 점프하지 않아도 이미 보인다.
  const segment = await page.evaluate(async (noteId) => {
    const response = await fetch(`/v1/notes/${noteId}/transcript`, {
      credentials: "include",
    });
    const body = await response.json();
    const last = body.data.segments.at(-1);
    return { id: last.segmentId as string, text: last.text as string };
  }, ENDED_NOTE_ID);

  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${ENDED_NOTE_ID}?tab=transcript&segment=${segment.id}`
  );

  // 행에는 발화 ID 속성이 없다 — 그 발화의 글로 찾는다
  const target = page
    .getByTestId("archive-transcript-block")
    .filter({ hasText: segment.text });
  await expect(target).toBeInViewport();
  await expect(target).toBeFocused();
  await expect(page).toHaveURL(/tab=transcript/);
  await expect(page).not.toHaveURL(/segment=/);
});

test("새 회의 주소로 들어와 창을 닫으면 노트 목록이 그대로다", async ({
  page,
}) => {
  await page.goto("/");
  await serviceWorkerReady(page);
  const before = await noteIds(page, PROJECT_ID);

  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/new?projectId=${PROJECT_ID}`
  );

  const dialog = page.getByRole("dialog", { name: "새 회의 만들기" });
  await expect(dialog).toBeVisible();
  // 노트는 만들어지지 않았고, 다시 열리지 않게 쿼리가 걷혔다
  await expect(page).toHaveURL(new RegExp(`/w/${MOCK_WORKSPACE_ID}$`));
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  expect(await noteIds(page, PROJECT_ID)).toEqual(before);
});

test("목록에 없는 프로젝트의 새 회의 주소는 창을 열지 않고 안내만 한다", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/new?projectId=01K9999999999`);

  await expect(
    page.getByText("회의를 시작할 프로젝트를 찾을 수 없습니다.")
  ).toBeVisible();
  await expect(page.getByRole("dialog", { name: "새 회의 만들기" })).toHaveCount(0);
});
