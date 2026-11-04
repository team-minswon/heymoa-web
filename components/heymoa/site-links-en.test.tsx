import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { intlWrapper } from "@/components/help/test-intl";
import { DesktopDownloadLink } from "@/components/heymoa/desktop-download-link";
import { HelpLink } from "@/components/heymoa/help-link";
import { FocusFooter } from "@/components/layout/focus-chrome";

describe("영어 화면의 사이트 링크", () => {
  afterEach(cleanup);

  it("다운로드·가이드·약관 링크가 영어 주소로 간다", () => {
    const { getAllByRole } = render(
      <>
        <DesktopDownloadLink />
        <HelpLink topic="troubleshooting" />
        <FocusFooter />
      </>,
      { wrapper: intlWrapper("en") }
    );
    const hrefs = getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/en/download?start=1");
    expect(hrefs).toContain("/en/terms");
    expect(hrefs).toContain("/en/privacy");
    expect(hrefs.some((href) => href?.startsWith("/en/help/"))).toBe(true);
  });

  it("한국어 화면은 무접두 주소 그대로다", () => {
    const { getAllByRole } = render(<FocusFooter />, {
      wrapper: intlWrapper("ko"),
    });
    expect(
      getAllByRole("link").map((link) => link.getAttribute("href"))
    ).toEqual(["/terms", "/privacy"]);
  });
});
