import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("고정 앱 다운로드", () => {
  it.each([
    ["mac", "arm64", "HeyMoa-mac-arm64.dmg"],

    ["windows", "x64", "HeyMoa-win-x64.exe"],
  ])("%s %s는 최신 공개 파일에 임시 연결합니다", (os, arch, file) => {
    const response = GET(
      new Request(`https://heymoa.app/download/app?os=${os}&arch=${arch}`)
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe(
      `https://github.com/team-minswon/homebrew-tap/releases/latest/download/${file}`
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it.each([
    "",
    "?os=mac",
    "?os=linux&arch=x64",
    "?os=mac&arch=x64",
    "?os=windows&arch=arm64",
    "?os=https://evil.invalid&arch=x64",
  ])("잘못된 입력 %s는 설치 안내로 돌아갑니다", (query) => {
    expect(
      GET(new Request(`https://heymoa.app/download/app${query}`)).headers.get(
        "Location"
      )
    ).toBe("https://heymoa.app/download");
  });
});
