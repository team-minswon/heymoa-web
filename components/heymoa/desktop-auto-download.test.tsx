import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DesktopAutoDownload } from "./desktop-auto-download";
import { desktopDownload, DESKTOP_INSTALLERS } from "@/lib/desktop/downloads";

const query = vi.hoisted(() => ({ value: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => query.value }));
vi.mock("@/lib/desktop/downloads", async (original) => ({
  ...(await original<typeof import("@/lib/desktop/downloads")>()),
  desktopDownload: vi.fn(),
}));
beforeEach(() => {
  query.value = new URLSearchParams("start=1");
  vi.mocked(desktopDownload).mockReset();
});
afterEach(cleanup);

it("새 안내 탭에서 공개 설치 파일을 다운로드합니다", async () => {
  vi.mocked(desktopDownload).mockResolvedValue({
    os: "windows",
    href: DESKTOP_INSTALLERS.windows[0].href,
  });
  render(<DesktopAutoDownload />);
  expect(await screen.findByTitle("HeyMoa 설치 파일 다운로드")).toHaveAttribute(
    "src",
    DESKTOP_INSTALLERS.windows[0].href
  );
});

it("다운로드 페이지를 직접 열면 자동으로 파일을 받지 않습니다", () => {
  query.value = new URLSearchParams();
  render(<DesktopAutoDownload />);
  expect(desktopDownload).not.toHaveBeenCalled();
});

it.each([{ os: "other" as const, href: "/download" }])(
  "자동 선택할 수 없으면 설치 파일 목록을 유지합니다: $os",
  async (target) => {
    vi.mocked(desktopDownload).mockResolvedValue(target);
    await act(async () => {
      render(<DesktopAutoDownload />);
    });
    expect(screen.queryByTitle("HeyMoa 설치 파일 다운로드")).toBeNull();
  }
);
