import { expect, test } from "@playwright/test";

for (const width of [1440, 1024]) {
  test(`desktop update settings download, opt-in and guarded restart at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      let state = {
        currentVersion: "0.1.4",
        automatic: false,
        status: "idle",
        canRestart: false,
        version: "0.1.5",
        percent: 0,
      };
      const listeners = new Set<(value: typeof state) => void>();
      const emit = () => {
        for (const listener of listeners) listener({ ...state });
        return { ...state };
      };
      Object.defineProperty(window, "heymoaDesktop", {
        value: {
          getUpdateState: async () => ({ ...state }),
          checkForUpdates: async () => {
            state = { ...state, status: "ready", percent: 100 };
            return emit();
          },
          setAutomaticUpdates: async (automatic: boolean) => {
            state.automatic = automatic;
            return emit();
          },
          restartForUpdate: async () => {
            if (state.canRestart) state.status = "installing";
            return emit();
          },
          subscribeUpdates: (listener: (value: typeof state) => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        },
      });
      Object.defineProperty(window, "allowUpdateRestart", {
        value: () => {
          state.canRestart = true;
          emit();
        },
      });
    });
    await page.goto("/w/01K0000000000?settings=appUpdates");
    await expect(
      page.getByRole("heading", { name: "앱 업데이트" })
    ).toBeVisible();
    await expect(page.getByText("현재 버전 0.1.4")).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "자동 업데이트" })
    ).not.toBeChecked();
    await page.getByRole("switch", { name: "자동 업데이트" }).click();
    await expect(
      page.getByRole("switch", { name: "자동 업데이트" })
    ).toBeChecked();
    await page.getByRole("button", { name: "업데이트 확인" }).click();
    const restart = page.getByRole("button", { name: "재시작하여 업데이트" });
    await expect(restart).toBeDisabled();
    await expect(page.getByRole("alert")).toContainText("전송 대기");
    const layout = await page
      .locator('[data-testid="settings-panel"]')
      .evaluate((panel) => {
        const heading = panel.querySelector("h2")!.getBoundingClientRect();
        const version = Array.from(panel.querySelectorAll("p"))
          .find((p) => p.textContent?.startsWith("현재 버전"))!
          .getBoundingClientRect();
        return {
          overflow: panel.scrollWidth > panel.clientWidth,
          headingLeft: heading.left,
          contentLeft: version.left,
        };
      });
    expect(layout.overflow).toBe(false);
    expect(layout.contentLeft - layout.headingLeft).toBe(17);
    await page.screenshot({ path: `/tmp/app-1551-updates-${width}.png` });
    await page.evaluate(() =>
      (window as unknown as { allowUpdateRestart(): void }).allowUpdateRestart()
    );
    await expect(restart).toBeEnabled();
    await restart.click();
    await expect(
      page.getByRole("status").filter({ hasText: "업데이트를 적용하기 위해" })
    ).toBeVisible();
  });
}

test("desktop appearance keeps opacity in settings and native menu opens it without replacing the page", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let opacity = 0.8;
    Object.defineProperty(window, "heymoaDesktop", {
      value: {
        getPanelOpacity: async () => opacity,
        setPanelOpacity: async (next: number) => {
          opacity = next;
          return opacity;
        },
        subscribeOpenSettings: (listener: (section: string) => void) => {
          Object.defineProperty(window, "openNativeSettings", {
            configurable: true,
            value: listener,
          });
          return () => {};
        },
        getUpdateState: async () => ({
          currentVersion: "0.1.5",
          automatic: true,
          status: "current",
          canRestart: false,
        }),
        checkForUpdates: async () => ({}),
        setAutomaticUpdates: async () => ({}),
        restartForUpdate: async () => ({}),
        subscribeUpdates: () => () => {},
      },
    });
  });
  await page.goto("/w/01K0000000000");
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { openNativeSettings?: unknown })
        .openNativeSettings === "function"
  );
  await page.evaluate(() =>
    (
      window as unknown as { openNativeSettings(section: string): void }
    ).openNativeSettings("desktopAppearance")
  );
  await expect(
    page.getByRole("heading", { name: "데스크톱 화면" })
  ).toBeVisible();
  const slider = page.getByRole("slider", { name: "팝업 불투명도" });
  await expect(slider).toHaveValue("80");
  await slider.focus();
  await slider.press("ArrowLeft");
  await expect(slider).toHaveValue("75");
  await expect(page.getByText("75%", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/app-1567-appearance-settings.png" });
  await page.getByRole("button", { name: "앱 업데이트", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "자동 업데이트" })
  ).toBeChecked();
  await expect(
    page.getByRole("complementary", { name: "앱 업데이트" })
  ).toHaveCount(0);
});
