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

for (const [tab, label] of [
  ["details", "정보"],
  ["transcript", "스크립트"],
  ["context", "타임라인"],
  ["summary", "요약"],
] as const) {
  test(`노트 조회가 끝나기 전에 ${label} 화면이 열린다`, async ({ page }) => {
    await page.addInitScript((noteId) => {
      const originalFetch = window.fetch.bind(window);
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      Object.assign(window, { releaseNoteFetch: release });
      window.fetch = async (input, init) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
          window.location.href
        );
        if (url.pathname === `/v1/notes/${noteId}`) await pending;
        return originalFetch(input, init);
      };
    }, ENDED_NOTE_ID);

    let evidence: { id: string; text: string } | undefined;
    if (tab === "transcript") {
      await page.goto("/");
      await serviceWorkerReady(page);
      evidence = await page.evaluate(async (noteId) => {
        const response = await fetch(`/v1/notes/${noteId}/transcript`);
        const body = await response.json();
        const last = body.data.segments.at(-1);
        return { id: last.segmentId as string, text: last.text as string };
      }, ENDED_NOTE_ID);
    }
    await page.goto(
      `/w/${MOCK_WORKSPACE_ID}/notes/${ENDED_NOTE_ID}?view=full&tab=${tab}${evidence ? `&segment=${evidence.id}` : ""}`
    );
    await expect(
      page.getByRole("tab", { name: label, exact: true })
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.locator('[data-slot="skeleton"][aria-label="노트 불러오는 중"]')
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "목록으로", exact: true })
    ).toBeVisible();
    await expect(page.getByText("요약은 회의가 끝나면 정리됩니다")).toHaveCount(
      0
    );
    if (tab === "summary") {
      await expect(page.getByLabel("검토본 불러오는 중")).toBeVisible();
    }
    if (evidence) {
      // 전사만 먼저 도착해도 임시 화면에서 근거 점프를 시작하지 않는다.
      const pendingTarget = page
        .getByTestId("transcript-block")
        .filter({ hasText: evidence.text });
      await expect(pendingTarget).toBeAttached();
      await expect(pendingTarget).not.toBeFocused();
    }

    await page.evaluate(() => {
      (
        window as unknown as { releaseNoteFetch: () => void }
      ).releaseNoteFetch();
    });
    await expect(
      page.locator('[data-slot="skeleton"][aria-label="노트 불러오는 중"]')
    ).toHaveCount(0);
    await expect(
      page.getByRole("tab", { name: label, exact: true })
    ).toHaveAttribute("aria-selected", "true");
    if (evidence) {
      const target = page
        .getByTestId("archive-transcript-block")
        .filter({ hasText: evidence.text });
      await expect(target).toBeFocused();
      await expect(target).toBeInViewport();
    }
  });
}

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

  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/new?projectId=${PROJECT_ID}`);

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
  await expect(
    page.getByRole("dialog", { name: "새 회의 만들기" })
  ).toHaveCount(0);
});
