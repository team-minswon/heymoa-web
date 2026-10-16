export const DESKTOP_RELEASES_URL =
  "https://github.com/team-minswon/homebrew-tap/releases";

// 공개된 버전만 가리킵니다. 새 릴리즈 게시·파일 검증 뒤 함께 갱신합니다.
export const DESKTOP_DOWNLOAD_VERSION = "0.1.2";
const release = `${DESKTOP_RELEASES_URL}/download/desktop-v${DESKTOP_DOWNLOAD_VERSION}/HeyMoa-${DESKTOP_DOWNLOAD_VERSION}`;
export const DESKTOP_INSTALLERS = {
  mac: [
    { label: "Apple Silicon용 다운로드", href: `${release}-mac-arm64.dmg` },
    { label: "Intel용 다운로드", href: `${release}-mac-x64.dmg` },
  ],
  windows: [{ label: "Windows용 다운로드", href: `${release}-win-x64.exe` }],
} as const;

type DownloadBrowser = Pick<Navigator, "userAgent" | "maxTouchPoints"> & {
  userAgentData?: {
    getHighEntropyValues?: (
      hints: string[]
    ) => Promise<{ architecture?: string }>;
  };
};

export async function desktopDownload(browser: DownloadBrowser): Promise<{
  os: "mac" | "windows" | "other";
  href: string | null;
}> {
  const ua = browser.userAgent;
  if (
    /Android|iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && browser.maxTouchPoints > 1)
  ) {
    return { os: "other", href: "/download" };
  }
  if (/Windows/.test(ua)) {
    return { os: "windows", href: DESKTOP_INSTALLERS.windows[0].href };
  }
  if (/Macintosh|Mac OS X/.test(ua)) {
    // Mac의 UA는 Apple Silicon에서도 Intel이라고 적힙니다. 칩 정보가 없으면 직접 고릅니다.
    let architecture: string | undefined;
    try {
      architecture = (
        await browser.userAgentData?.getHighEntropyValues?.(["architecture"])
      )?.architecture;
    } catch {
      // 브라우저가 칩 정보 제공을 거절하면 선택 메뉴를 보여 줍니다.
    }
    const installer =
      architecture === "arm"
        ? DESKTOP_INSTALLERS.mac[0]
        : architecture === "x86"
          ? DESKTOP_INSTALLERS.mac[1]
          : null;
    return { os: "mac", href: installer?.href ?? null };
  }
  return { os: "other", href: "/download" };
}
