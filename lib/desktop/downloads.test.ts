import { describe, expect, it, vi } from "vitest";
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

  it.each([
    ["arm", 0],
    ["x86", 1],
  ] as const)(
    "실제 칩 정보 %s로 Mac 설치 파일을 고릅니다",
    async (architecture, index) => {
      const getHighEntropyValues = vi.fn().mockResolvedValue({ architecture });
      expect(
        await desktopDownload({
          userAgent: "Macintosh; Intel Mac OS X",
          maxTouchPoints: 0,
          userAgentData: { getHighEntropyValues },
        })
      ).toEqual({ os: "mac", href: DESKTOP_INSTALLERS.mac[index].href });
      expect(getHighEntropyValues).toHaveBeenCalledWith(["architecture"]);
    }
  );

  it("Mac UA의 Intel 표기로 칩을 추측하지 않습니다", async () => {
    expect(
      await desktopDownload({
        userAgent: "Macintosh; Intel Mac OS X",
        maxTouchPoints: 0,
      })
    ).toEqual({ os: "mac", href: null });
  });

  it("칩 정보 조회를 거절해도 Mac 선택 메뉴를 사용합니다", async () => {
    expect(
      await desktopDownload({
        userAgent: "Macintosh; Intel Mac OS X",
        maxTouchPoints: 0,
        userAgentData: {
          getHighEntropyValues: vi.fn().mockRejectedValue(new Error("denied")),
        },
      })
    ).toEqual({ os: "mac", href: null });
  });
});
