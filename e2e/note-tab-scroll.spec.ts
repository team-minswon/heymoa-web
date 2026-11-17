import { expect, type Page, test } from "@playwright/test";

const MENTORING_NOTE = "01K0000000920";
const LIVE_NOTE = "01K0000000016";
const QUERY = { 스크립트: "transcript", 타임라인: "context", 요약: "summary" };

const viewportOf = (page: Page, tab: string) =>
  page
    .getByRole("tabpanel", { name: tab })
    .locator("[data-slot=scroll-area-viewport]")
    .first();

const looking = (page: Page, tab: string) =>
  viewportOf(page, tab).evaluate((node) => {
    const bounds = node.getBoundingClientRect();
    const element = document.elementFromPoint(
      bounds.left + bounds.width / 2,
      bounds.top + 120
    );
    return (
      element
        ?.closest("li, [data-segment-id], [data-item-id], section, p, div")
        ?.textContent?.replace(/\s+/g, " ")
        .slice(0, 60) ?? null
    );
  });

for (const { tab, other, noteId } of [
  { tab: "스크립트", other: "타임라인", noteId: MENTORING_NOTE },
  { tab: "타임라인", other: "요약", noteId: MENTORING_NOTE },
  { tab: "요약", other: "스크립트", noteId: MENTORING_NOTE },
  { tab: "타임라인", other: "스크립트", noteId: LIVE_NOTE },
] as const) {
  test(`${noteId} ${other} 탭에 다녀와도 ${tab} 탭이 읽던 위치로 돌아옵니다`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto(
      `/w/01K0000000000/notes/${noteId}?view=full&tab=${QUERY[tab]}`
    );
    const viewport = viewportOf(page, tab);
    const room = () =>
      viewport.evaluate((node) => node.scrollHeight - node.clientHeight);
    await expect.poll(room, { timeout: 30_000 }).toBeGreaterThan(400);
    await viewport.hover();
    await page.mouse.wheel(0, -100_000);
    const target = Math.round((await room()) / 2);
    for (let moved = 0; moved < target; moved += 800) {
      await page.mouse.wheel(0, Math.min(800, target - moved));
    }
    await expect
      .poll(() => viewport.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(target / 2);
    await expect.poll(() => looking(page, tab)).not.toBeNull();
    const reading = await looking(page, tab);

    await page.getByRole("tab", { name: other }).click();
    await expect(page.getByRole("tabpanel", { name: other })).toBeVisible();
    const refetch =
      noteId === MENTORING_NOTE && tab !== "타임라인"
        ? page.waitForRequest((request) =>
            tab === "스크립트"
              ? /\/v1\/workspaces\/[^/]+\/members/.test(request.url())
              : /\/meeting-review$/.test(new URL(request.url()).pathname)
          )
        : null;
    await page.getByRole("tab", { name: tab }).click();
    await refetch;

    await expect.poll(() => looking(page, tab)).toBe(reading);
  });
}
