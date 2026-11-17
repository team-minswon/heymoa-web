import { expect, test, type Locator, type Page } from "@playwright/test";
import { settled } from "./helpers-ui";

const WORKSPACE_ID = "01K0000000000";
const NOTE_ID = "01K0000000020";

const MAX_SHIFT_PX = 8;

/** `page.route` 로는 못 늦춥니다. MSW 서비스 워커 응답은 Playwright 네트워크 층까지 안 내려와 페이지 안에서 `fetch` 를 감쌉니다. */
async function holdResponses(page: Page, pattern: string) {
  await page.addInitScript((source) => {
    const target = new RegExp(source);
    const released = new Promise<void>((resolve) =>
      window.addEventListener("e2e:release-api", () => resolve(), {
        once: true,
      })
    );
    const original = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const input = args[0] instanceof Request ? args[0].url : String(args[0]);
      if (target.test(new URL(input, location.origin).pathname)) {
        await released;
      }
      return original(...args);
    };
  }, pattern);
  return () =>
    page.evaluate(() => window.dispatchEvent(new Event("e2e:release-api")));
}

async function shiftOf(
  page: Page,
  label: string,
  release: () => Promise<boolean>
) {
  const skeleton = page.locator(`[aria-label="${label}"]`);
  await expect(skeleton).toBeVisible();

  const before = await skeleton.evaluate((el) =>
    Math.round(el.getBoundingClientRect().height)
  );
  const parentIndex = await skeleton.evaluate((el) => {
    const parent = el.parentElement!;
    parent.setAttribute("data-skeleton-slot", "1");
    return [...parent.children].indexOf(el);
  });

  await release();
  await expect(skeleton).toBeHidden({ timeout: 15_000 });

  const after = await page.evaluate((index) => {
    const parent = document.querySelector("[data-skeleton-slot]");
    const child = parent?.children[index] ?? parent;
    return child ? Math.round(child.getBoundingClientRect().height) : 0;
  }, parentIndex);

  return { before, after, shift: Math.abs(after - before) };
}

test.describe("스켈레톤 기하", () => {
  test("노트 정보 탭이 도착할 때 자리가 크게 안 밀린다", async ({ page }) => {
    const release = await holdResponses(page, `/v1/notes/${NOTE_ID}$`);
    await page.goto(
      `/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full&tab=details`
    );

    const { before, after, shift } = await shiftOf(
      page,
      "노트 정보 불러오는 중",
      release
    );

    expect(before, "스켈레톤이 자리를 잡아야 한다").toBeGreaterThan(0);
    expect(after, "도착한 내용도 자리를 차지해야 한다").toBeGreaterThan(0);
    expect(shift, `스켈레톤 ${before} → 실제 ${after}`).toBeLessThanOrEqual(
      MAX_SHIFT_PX
    );
  });

  test("할 일 목록의 스켈레톤 줄과 실제 줄의 높이가 같다", async ({ page }) => {
    const release = await holdResponses(page, "/tasks$");
    await page.goto(`/w/${WORKSPACE_ID}/tasks`);

    const loading = page.locator('[aria-label="할 일 불러오는 중"]');
    await expect(loading).toBeVisible();
    const skeletonRow = await loading
      .locator("li")
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().height));
    const skeletonTop = await loading
      .locator("li")
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().top));

    await release();
    await expect(loading).toBeHidden({ timeout: 15_000 });
    const [realRow, realTop] = await page
      .locator("li.group.rounded-control")
      .first()
      .evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return [Math.round(rect.height), Math.round(rect.top)];
      });
    expect(
      Math.abs(skeletonTop - realTop),
      `스켈레톤 첫 줄 위치 ${skeletonTop} → 실제 ${realTop}`
    ).toBeLessThanOrEqual(4);

    expect(
      Math.abs(skeletonRow - realRow),
      `스켈레톤 줄 ${skeletonRow} → 실제 줄 ${realRow}`
    ).toBeLessThanOrEqual(4);
  });

  for (const width of [1440, 1024]) {
    for (const section of [
      "members",
      "guests",
      "terms",
      "integrations",
      "workspaceAgents",
      "account",
      "agents",
    ] as const) {
      test(`설정 「${section}」 탭이 도착할 때 높이가 안 바뀐다 (${width}px)`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        const target = {
          members: "/(members|invitations)$",
          guests: "/guests$",
          terms: "/terms$",
          integrations: "/integrations$",
          workspaceAgents: "/(members|agent-delegations)$",
          account: "/v1/users/me$",
          agents: "/v1/agent-delegations$",
        }[section];
        const release = await holdResponses(page, target);
        await page.goto(`/w/${WORKSPACE_ID}?settings=${section}`);

        const panel = page.getByTestId("settings-panel");
        const skeleton = panel.locator('[data-slot="skeleton"]');
        await expect(skeleton.first()).toBeVisible();
        const tabHeight = () =>
          panel.evaluate((el) =>
            Math.round(el.firstElementChild!.getBoundingClientRect().height)
          );
        const before = await tabHeight();

        await release();
        await expect(skeleton).toHaveCount(0, { timeout: 15_000 });
        await settled(panel);
        const after = await tabHeight();

        expect(
          Math.abs(after - before),
          `스켈레톤 ${before} → 실제 ${after}`
        ).toBeLessThanOrEqual(MAX_SHIFT_PX);
      });
    }
  }

  test("설정 「알림」 탭의 종류 행이 skeleton 과 같은 자리·높이로 선다", async ({
    page,
  }) => {
    const release = await holdResponses(page, "/v1/notification-settings$");
    await page.goto(`/w/${WORKSPACE_ID}?settings=notifications`);

    const loading = page.locator('[aria-label="알림 설정 불러오는 중"]');
    await expect(loading).toBeVisible();
    const rowOf = (row: Locator) =>
      row.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return [Math.round(rect.height), Math.round(rect.top)];
      });
    const [skeletonRow, skeletonTop] = await rowOf(
      loading.locator("tbody tr").first()
    );

    await release();
    await expect(loading).toBeHidden({ timeout: 15_000 });
    const [realRow, realTop] = await rowOf(
      page.locator('[aria-label="알림 설정"] tbody tr').first()
    );

    expect(
      Math.abs(skeletonTop - realTop),
      `스켈레톤 첫 행 위치 ${skeletonTop} → 실제 ${realTop}`
    ).toBeLessThanOrEqual(MAX_SHIFT_PX);
    expect(
      Math.abs(skeletonRow - realRow),
      `스켈레톤 행 ${skeletonRow} → 실제 행 ${realRow}`
    ).toBeLessThanOrEqual(MAX_SHIFT_PX);
  });
});
