import { expect, type Locator, type Page } from "@playwright/test";

/** 키보드 단축키는 SSR HTML만 떠 있어도 전송됩니다. 실제 검색 창 왕복으로 이벤트 연결을 확인합니다. */
export async function openGuide(page: Page, path: string) {
  await page.goto(path);
  // Esc는 본문 검색도 닫으므로, 검색어로 직접 진입하는 검사는 그 표면 자체를 기다립니다.
  if (new URL(page.url()).searchParams.has("q")) return;
  await page.locator('button[aria-keyshortcuts="Control+K Meta+K"]').click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}

/** 글꼴과 실제 전환이 끝난 뒤 기하를 잽니다. 스피너 같은 무한 애니메이션은 기다리지 않습니다. */
export async function settled(locator: Locator) {
  await expect(locator).toBeVisible();
  await locator.evaluate(async (element) => {
    await document.fonts.ready;
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity
        )
        .map((animation) => animation.finished.catch(() => {}))
    );
  });
  return locator;
}
