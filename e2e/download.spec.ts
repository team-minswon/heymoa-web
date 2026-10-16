import { expect, test } from "@playwright/test";

for (const platform of [
  {
    ua: "Macintosh; Intel Mac OS X",
    architecture: "arm",
    label: "macOS 다운로드",
    suffix: "mac-arm64.dmg",
  },
  {
    ua: "Windows NT 10.0; Win64; x64",
    architecture: "x86",
    label: "Windows 다운로드",
    suffix: "win-x64.exe",
  },
]) {
  test(`landing shows a stable ${platform.label} button`, async ({
    page,
    context,
  }) => {
    await context.addInitScript(({ ua, architecture }) => {
      Object.defineProperty(navigator, "userAgent", { value: ua });
      Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
      Object.defineProperty(navigator, "userAgentData", {
        value: { getHighEntropyValues: async () => ({ architecture }) },
      });
    }, platform);
    await page.goto("/");
    const button = page.getByRole("link", {
      name: platform.label,
      exact: true,
    });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute(
      "href",
      new RegExp(`${platform.suffix}$`)
    );
    await expect(button).toHaveCSS("width", "180px");
    await expect(
      page.getByRole("link", { name: "예시 회의 먼저 보기" })
    ).toHaveCount(0);
    await expect(
      page
        .locator("header")
        .getByRole("link", { name: "앱 다운로드", exact: true })
    ).toBeVisible();

    const filename = `HeyMoa-0.1.2-${platform.suffix}`;
    const downloads: string[] = [];
    page.on("download", (download) =>
      downloads.push(download.suggestedFilename())
    );
    context.on("page", (popup) => {
      popup.on("download", (download) =>
        downloads.push(download.suggestedFilename())
      );
    });
    await context.route(`**/${filename}`, (route) =>
      route.fulfill({
        contentType: "application/octet-stream",
        headers: {
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
        body: "installer fixture",
      })
    );
    await page
      .locator("header")
      .getByRole("link", { name: "앱 다운로드", exact: true })
      .click();
    await expect(page).toHaveURL(/\/download$/);
    await expect.poll(() => downloads).toContain(filename);

    await page.goto("/w/01K0000000000");
    await expect(
      page.getByRole("link", { name: platform.label, exact: true })
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "데스크톱 앱 안내 닫기" })
    ).toHaveCount(0);
    await page.getByRole("button", { name: "웹과 앱의 차이" }).hover();
    const tooltip = page.locator('[data-slot="tooltip-content"]');
    await expect(tooltip).toHaveText("웹과 앱의 차이 보기");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "웹과 앱의 차이" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "기록할 수 있는 소리" })
    ).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await page
      .getByRole("button", { name: "2. 창을 닫아도 이어지는 녹음" })
      .click();
    await expect(
      page.getByRole("img", {
        name: "Mac 메뉴 막대에서 녹음 상태와 회의 타임라인을 보는 예시",
      })
    ).toBeVisible();
    await page.getByRole("button", { name: "3. 사용하던 기록 그대로" }).click();
    await expect(
      page.getByRole("dialog").getByRole("link", { name: platform.label })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    const guideOpened = context.waitForEvent("page");
    await page.getByRole("link", { name: platform.label, exact: true }).click();
    const guide = await guideOpened;
    await expect(guide).toHaveURL(/\/download\?start=1$/);
    await expect(
      guide.getByRole("heading", { name: "HeyMoa 앱 설치" })
    ).toBeVisible();
    await expect
      .poll(() => downloads.filter((name) => name === filename).length)
      .toBe(2);
    await expect(page).toHaveURL(/\/w\/01K0000000000$/);
  });
}

test("desktop guide step controls stay aligned on wide and narrow screens", async ({
  page,
}) => {
  await page.goto("/w/01K0000000000");
  await page.getByRole("button", { name: "웹과 앱의 차이" }).click();
  const steps = page
    .getByRole("navigation", { name: "데스크톱 앱 안내 단계" })
    .getByRole("button");
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await steps.nth(0).click();
    const baseline = await steps.nth(0).boundingBox();
    expect(baseline).not.toBeNull();
    for (let index = 0; index < 3; index++) {
      await steps.nth(index).click();
      const current = await steps.nth(index).boundingBox();
      expect(current).not.toBeNull();
      expect(Math.abs(current!.y - baseline!.y)).toBeLessThanOrEqual(1);
      expect(current!.width).toBe(baseline!.width);
      expect(current!.height).toBe(baseline!.height);
      const overflow = await page
        .getByRole("dialog")
        .evaluate((dialog) => dialog.scrollWidth > dialog.clientWidth);
      expect(overflow).toBe(false);
    }
  }
});

test("anonymous visitors can reach desktop downloads without starting OAuth", async ({
  page,
}) => {
  const oauthRequests: string[] = [];
  page.on("request", (request) => {
    if (/accounts\.google\.com|oauth2\/authorization/.test(request.url()))
      oauthRequests.push(request.url());
  });
  await page.goto("/");
  await page
    .locator("footer")
    .getByRole("link", { name: "데스크톱 다운로드" })
    .click();
  await expect(page).toHaveURL(/\/download$/);
  // 다운로드도 랜딩 크롬이다(`isLandingChromeRoute`) — 마케팅 Navbar(떠 있는 알약)가 서면 안 된다.
  await expect(page.locator("header.rounded-full")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "버전 기록 보기 (GitHub)" })
  ).toHaveCount(0);
  for (const [name, suffix] of [
    ["Apple Silicon용 다운로드", "mac-arm64.dmg"],
    ["Intel용 다운로드", "mac-x64.dmg"],
    ["Windows용 다운로드", "win-x64.exe"],
  ]) {
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute(
      "href",
      `https://github.com/team-minswon/homebrew-tap/releases/download/desktop-v0.1.2/HeyMoa-0.1.2-${suffix}`
    );
  }
  await expect(
    page.getByText("brew install --cask team-minswon/tap/heymoa", {
      exact: true,
    })
  ).toBeVisible();
  const windowsSteps = page
    .getByRole("list", { name: "Windows 설치 방법" })
    .getByRole("listitem");
  await expect(windowsSteps).toHaveText([
    "다운로드한 설치 파일을 실행하세요.",
    "「Windows의 PC 보호」 창이 뜨면 「추가 정보」를 누르세요.",
    "「실행」을 누르고 설치를 진행하세요.",
  ]);
  await expect(
    page.getByText("서명되지 않은 설치 파일에는", { exact: false })
  ).toHaveCount(0);
  expect(oauthRequests).toEqual([]);
});
