export const DESKTOP_RELEASES_URL =
  "https://github.com/team-minswon/homebrew-tap/releases";

// 설치 파일 링크는 이 목록을 공유합니다. 앱 버전은 공개 릴리스의 latest가 결정합니다.
// 버튼 글은 언어마다 달라 언어 파일(`download.platforms.<os>.installer`)에 있습니다.
export const DESKTOP_INSTALLERS = {
  mac: [
    {
      href: "/download/app?os=mac&arch=arm64",
      file: "HeyMoa-mac-arm64.dmg",
    },
  ],
  windows: [
    {
      href: "/download/app?os=windows&arch=x64",
      file: "HeyMoa-win-x64.exe",
    },
  ],
} as const;

type DownloadBrowser = Pick<Navigator, "userAgent" | "maxTouchPoints">;

export async function desktopDownload(browser: DownloadBrowser): Promise<{
  os: "mac" | "windows" | "other";
  href: string;
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
    return { os: "mac", href: DESKTOP_INSTALLERS.mac[0].href };
  }
  return { os: "other", href: "/download" };
}
