import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { DesktopDownloadLink } from "./desktop-download-link";
import { desktopDownload } from "@/lib/desktop/downloads";
import { track } from "@/lib/analytics/track";

vi.mock("@/lib/desktop/downloads", () => ({ desktopDownload: vi.fn() }));
vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it.each([
  ["mac", "macOS 다운로드"],
  ["windows", "Windows 다운로드"],
  ["other", "앱 다운로드"],
] as const)(
  "%s에서는 OS 이름과 아이콘으로 새 설치 안내 탭을 엽니다",
  async (os, label) => {
    vi.mocked(desktopDownload).mockResolvedValue({ os, href: "/download" });
    render(<DesktopDownloadLink />);
    const link = await screen.findByRole("link", { name: label });
    expect(link).toHaveAttribute("href", "/download?start=1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveClass("w-fit");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(track).toHaveBeenCalledWith("desktop_download_clicked");
  }
);

it("OS 확인 중에는 글자 없이 스피너를 표시합니다", async () => {
  let resolve!: (target: Awaited<ReturnType<typeof desktopDownload>>) => void;
  vi.mocked(desktopDownload).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  render(<DesktopDownloadLink />);
  const loading = screen.getByRole("link", { name: "앱 다운로드 확인 중" });
  expect(loading).toHaveAttribute("aria-busy", "true");
  expect(loading).toHaveTextContent(/^$/);
  expect(loading).toHaveClass("min-w-11");
  resolve({ os: "mac", href: "/download" });
  expect(
    await screen.findByRole("link", { name: "macOS 다운로드" })
  ).toHaveClass("w-fit");
});
