import { describe, expect, it } from "vitest";
import { desktopDownload, DESKTOP_INSTALLERS } from "./downloads";

describe("desktopDownload", () => {
  it("Windows를 설치 파일로 연결합니다", async () => {
    expect(
      await desktopDownload({
        userAgent: "Windows NT 10.0; Win64; x64",
        maxTouchPoints: 0,
      })
    ).toEqual({ os: "windows", href: DESKTOP_INSTALLERS.windows[0].href });
  });

  it.each(["Android", "iPhone", "iPad", "Linux", "unknown"])(
    "%s는 다운로드 페이지로 연결합니다",
    async (userAgent) => {
      expect(await desktopDownload({ userAgent, maxTouchPoints: 0 })).toEqual({
        os: "other",
        href: "/download",
      });
    }
  );

  it("Mac으로 표시되는 iPad도 다운로드 페이지로 연결합니다", async () => {
    expect(
      await desktopDownload({
        userAgent: "Macintosh; Intel Mac OS X",
        maxTouchPoints: 5,
      })
    ).toEqual({ os: "other", href: "/download" });
  });

  it("Mac UA의 Intel 표기와 관계없이 Apple Silicon용 파일을 제공합니다", async () => {
    expect(
      await desktopDownload({
        userAgent: "Macintosh; Intel Mac OS X",
        maxTouchPoints: 0,
      })
    ).toEqual({ os: "mac", href: DESKTOP_INSTALLERS.mac[0].href });
    expect(DESKTOP_INSTALLERS.mac).toHaveLength(1);
  });
});
