import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * **스켈레톤이 최종 기하와 같은 자리를 잡는가.**
 *
 * 규칙(`rules/error-loading.md`)이 「컨테이너의 padding·gap·margin까지 같아야 한다」고
 * 적었고 실측 표까지 남겼는데, **그 표를 지키는 검사가 없었다.** 그래서 한 번 맞춰 놓은
 * 값이 화면을 고칠 때마다 조용히 어긋난다 — 그 표가 기록한 노트 정보 탭은 296 대 568 이었다.
 *
 * jsdom 은 레이아웃을 계산하지 않으므로 **vitest 로는 원리적으로 못 잰다.** 여기가 유일한
 * 자리다.
 *
 * **절대 높이를 못박지 않는다.** 문구 한 줄이 늘면 값이 바뀌는 것이 정상이고, 그때마다
 * baseline 을 갱신하라고 시끄럽게 구는 검사는 결국 꺼진다. 재는 것은 **스켈레톤과 도착한
 * 것의 차이** 하나다.
 *
 * 설정 다이얼로그의 탭들(APP-1350)도 여기서 본다. 아카이브 전사는 아직 안 덮는다.
 */

const WORKSPACE_ID = "01K0000000000";
/** 화자 분리까지 끝난 종료 노트. 정보가 다 차 있어 최종 기하가 가장 크다. */
const NOTE_ID = "01K0000000020";

/**
 * **실측해서 정했다.** 지금 이 화면의 어긋남은 0px 이라 허용치는 순수한 여유분이다.
 *
 * 처음엔 40 으로 뒀는데 그것은 규칙이 말하는 것을 못 지킨다 — 정보 탭의 `Fact` 한 줄이
 * 30px 라, 한 줄을 통째로 빼먹어도 40 안에 들어와 초록이 된다. 한 줄보다 작게 잡는다.
 */
const MAX_SHIFT_PX = 8;

/**
 * 목이 즉답이라 그냥 열면 스켈레톤이 한 프레임도 안 보인다. 붙잡아 둔다.
 *
 * **`page.route` 로는 못 늦춘다.** MSW 가 서비스 워커라 그 응답은 Playwright 가 가로채는
 * 네트워크 층까지 안 내려온다. 페이지 안에서 `fetch` 를 감싸야 한다 — 앱의 호출이 워커에
 * 닿기 전에 지난다.
 */
async function holdResponses(page: Page, ms = 1200) {
  await page.addInitScript((delay) => {
    const original = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      if (String(args[0]).includes("/v1/")) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return original(...args);
    };
  }, ms);
}

/**
 * 스켈레톤이 있던 **자리**의 높이를 뜬 순간과 도착한 순간에 각각 잰다.
 *
 * 부모는 안 바뀌므로 그 자식의 높이를 두 번 재면 같은 자리를 비교하는 것이 된다.
 */
async function shiftOf(page: Page, label: string) {
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
    await holdResponses(page);
    await page.goto(
      `/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full&tab=details`
    );

    const { before, after, shift } = await shiftOf(
      page,
      "노트 정보 불러오는 중"
    );

    expect(before, "스켈레톤이 자리를 잡아야 한다").toBeGreaterThan(0);
    expect(after, "도착한 내용도 자리를 차지해야 한다").toBeGreaterThan(0);
    expect(shift, `스켈레톤 ${before} → 실제 ${after}`).toBeLessThanOrEqual(
      MAX_SHIFT_PX
    );
  });

  /**
   * **목록은 줄 수로도 튄다.** 여기서는 줄 하나의 높이가 같은지만 본다 — 개수는 화면마다
   * 다르고, 줄 높이가 어긋나면 개수와 무관하게 전부 밀린다.
   */
  test("할 일 목록의 스켈레톤 줄과 실제 줄의 높이가 같다", async ({ page }) => {
    await holdResponses(page);
    await page.goto(`/w/${WORKSPACE_ID}/tasks`);

    const loading = page.locator('[aria-label="할 일 불러오는 중"]');
    await expect(loading).toBeVisible();
    const skeletonRow = await loading
      .locator("li")
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().height));
    // 첫 줄이 서는 **자리**도 같아야 한다 — 진행 중은 묶음 머리 아래에 줄이 선다. 스켈레톤이 머리 없이 줄만 세우면 도착할 때
    // 목록이 머리만큼 밀린다(APP-1207 P3 · APP-1212).
    const skeletonTop = await loading
      .locator("li")
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().top));

    await expect(loading).toBeHidden({ timeout: 15_000 });
    // **`main li` 로 잡으면 안 된다.** 사이드바 메뉴도 `main` 안의 `li` 라서 그쪽(32)을
    // 집고, 스켈레톤(44)과 안 맞는다며 없는 어긋남을 만들어 낸다. 실제로 한 번 그랬다.
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

  /**
   * **설정 탭은 탭 전체의 높이를 비교한다(APP-1350).** 탭마다 skeleton 이 여럿으로 나뉘고(멤버는 목록 + 관리자 자리,
   * 임시 참여자는 인원 줄 + 목록) 조회가 차례로 붙어(멤버 → 대기 중인 초대) 한 자리만 재면 나머지가 밀린 것을 놓친다.
   * 행 수는 목 시드에 맞춰 뒀으므로 목에서는 차이가 0 이어야 한다.
   *
   * 「일반」은 없다 — 워크스페이스 조회를 셸이 서버에서 채워 두어 그 skeleton 은 목에서 한 프레임도 안 선다.
   * 「알림」은 행 수가 목(1)과 운영(2)이 달라 아래 따로 본다.
   */
  for (const width of [1440, 1024]) {
    for (const section of [
      "members",
      "guests",
      "terms",
      "integrations",
      "workspaceAgents",
      "account",
      "agents",
    ]) {
      test(`설정 「${section}」 탭이 도착할 때 높이가 안 바뀐다 (${width}px)`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await holdResponses(page);
        await page.goto(`/w/${WORKSPACE_ID}?settings=${section}`);

        const panel = page.getByTestId("settings-panel");
        const skeleton = panel.locator('[data-slot="skeleton"]');
        await expect(skeleton.first()).toBeVisible();
        const tabHeight = () =>
          panel.evaluate((el) =>
            Math.round(el.firstElementChild!.getBoundingClientRect().height)
          );
        const before = await tabHeight();

        // 뒤따르는 조회(역할 → 대기 중인 초대·열린 연결)가 또 skeleton 을 세웠다 걷을 때까지 기다린다.
        await expect(skeleton).toHaveCount(0, { timeout: 15_000 });
        await page.waitForTimeout(2_000);
        await expect(skeleton).toHaveCount(0, { timeout: 15_000 });
        const after = await tabHeight();

        expect(
          Math.abs(after - before),
          `스켈레톤 ${before} → 실제 ${after}`
        ).toBeLessThanOrEqual(MAX_SHIFT_PX);
      });
    }
  }

  /**
   * **알림은 행 하나의 높이와 첫 행 위치를 본다.** skeleton 은 운영이 내는 선택 종류 둘(중지된 회의 · 검토할 결과 준비)을
   * 세우는데 목은 아직 하나라, 탭 전체 높이는 한 행만큼 다른 것이 맞다.
   */
  test("설정 「알림」 탭의 종류 행이 skeleton 과 같은 자리·높이로 선다", async ({
    page,
  }) => {
    await holdResponses(page);
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
