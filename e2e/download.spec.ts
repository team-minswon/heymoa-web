import { expect, test } from "@playwright/test";

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
  const release = page.getByRole("link", { name: "설치 파일과 새 버전 보기" });
  await expect(release).toHaveAttribute(
    "href",
    "https://github.com/team-minswon/homebrew-tap/releases"
  );
  await expect(release).toHaveAttribute("rel", "noopener noreferrer");
  await expect(
    page.getByText("자동 업데이트는 제공하지 않으므로", { exact: false })
  ).toBeVisible();
  expect(oauthRequests).toEqual([]);
});
