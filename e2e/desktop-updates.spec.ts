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

for (const locale of ["ko-KR", "en-US"]) {
  test(`native settings replace the redundant hosted page in ${locale}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale });
    await context.addCookies([
      {
        name: "heymoa-mock-account-lang",
        value: locale === "ko-KR" ? "ko" : "en",
        url: "http://localhost:3100",
      },
    ]);
    const page = await context.newPage();
    const nativeSettingsLabel =
      locale === "ko-KR" ? "데스크톱 설정 열기" : "Open desktop settings";
    await page.addInitScript(() => {
      Object.assign(window, {
        nativePreferencesOpened: 0,
        heymoaDesktop: {
          getUpdateState: async () => ({
            currentVersion: "0.1.6",
            status: "current",
            automatic: true,
            canRestart: false,
          }),
          checkForUpdates: async () => ({}),
          setAutomaticUpdates: async () => ({}),
          restartForUpdate: async () => ({}),
          subscribeUpdates: () => () => {},
          openPreferences: () => {
            if (!navigator.userActivation.isActive)
              throw new Error("USER_GESTURE_REQUIRED");
            const w = window as unknown as { nativePreferencesOpened: number };
            w.nativePreferencesOpened++;
            return Promise.resolve();
          },
        },
      });
    });
    try {
      await page.goto("/w/01K0000000000?settings=account");
      const settings = page.getByRole("dialog");
      await expect(settings).toBeVisible();
      await expect(
        settings.getByRole("button", { name: /^(앱 업데이트|App updates)$/ })
      ).toHaveCount(0);
      await page.goto(
        "/w/01K0000000000?settings=appUpdates&keep=value#retained"
      );
      await expect(
        page.getByRole("button", {
          name: nativeSettingsLabel,
        })
      ).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { nativePreferencesOpened: number })
              .nativePreferencesOpened
        )
      ).toBe(0);
      await page
        .getByRole("button", {
          name: nativeSettingsLabel,
        })
        .click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as unknown as { nativePreferencesOpened: number })
                .nativePreferencesOpened
          )
        )
        .toBe(1);
      await expect(page).toHaveURL(/keep=value#retained$/);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: nativeSettingsLabel,
        })
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}
