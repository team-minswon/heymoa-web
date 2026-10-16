export const DESKTOP_RELEASES_URL =
  "https://github.com/team-minswon/homebrew-tap/releases";

// 공개된 버전만 가리킵니다. 새 릴리즈 게시·파일 검증 뒤 함께 갱신합니다.
export const DESKTOP_DOWNLOAD_VERSION = "0.1.1";
const release = `${DESKTOP_RELEASES_URL}/download/desktop-v${DESKTOP_DOWNLOAD_VERSION}/HeyMoa-${DESKTOP_DOWNLOAD_VERSION}`;
export const DESKTOP_INSTALLERS = {
  mac: [
    { label: "Apple Silicon용 다운로드", href: `${release}-mac-arm64.dmg` },
    { label: "Intel용 다운로드", href: `${release}-mac-x64.dmg` },
  ],
  windows: [{ label: "Windows용 다운로드", href: `${release}-win-x64.exe` }],
} as const;
