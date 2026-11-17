import { expect, type Locator, type Page } from "@playwright/test";

export async function openGuide(page: Page, path: string) {
  await page.goto(path);
  if (new URL(page.url()).searchParams.has("q")) return;
  await page.locator('button[aria-keyshortcuts="Control+K Meta+K"]').click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}

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
