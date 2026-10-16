import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppDownloadLink } from "./app-download-link";
import { DESKTOP_INSTALLERS, desktopDownload } from "@/lib/desktop/downloads";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
beforeEach(() => push.mockReset());

vi.mock("@/lib/desktop/downloads", async (original) => ({
  ...(await original<typeof import("@/lib/desktop/downloads")>()),
  desktopDownload: vi.fn(),
}));
vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));
afterEach(cleanup);

it("OS를 확인하는 동안 버튼 전체를 같은 너비로 유지합니다", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof desktopDownload>>) => void;
  vi.mocked(desktopDownload).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  render(<AppDownloadLink />);
  const loading = screen.getByRole("button", { name: "앱 다운로드 확인 중" });
  expect(loading).toBeDisabled();
  expect(loading).toHaveAttribute("aria-busy", "true");
  expect(loading).toHaveClass("w-[180px]");
  expect(loading).toHaveTextContent(/^$/);
  expect(loading.querySelector("[aria-hidden]")).toHaveAttribute(
    "aria-hidden",
    "true"
  );
  resolve({ os: "windows", href: DESKTOP_INSTALLERS.windows[0].href });
  expect(
    await screen.findByRole("link", { name: "Windows 다운로드" })
  ).toHaveClass("w-[180px]");
});

it("Windows 다운로드는 파일 링크를 표시합니다", async () => {
  vi.mocked(desktopDownload).mockResolvedValue({
    os: "windows",
    href: DESKTOP_INSTALLERS.windows[0].href,
  });
  render(<AppDownloadLink />);
  expect(
    await screen.findByRole("link", { name: "Windows 다운로드" })
  ).toHaveAttribute("href", DESKTOP_INSTALLERS.windows[0].href);
});

it("상단 메뉴는 파일 다운로드를 먼저 시작하고 다운로드 페이지로 이동합니다", async () => {
  const order: string[] = [];
  const open = vi.spyOn(window, "open").mockImplementation(() => {
    order.push("download");
    return null;
  });
  push.mockImplementation(() => {
    order.push("page");
  });
  vi.mocked(desktopDownload).mockResolvedValue({
    os: "windows",
    href: DESKTOP_INSTALLERS.windows[0].href,
  });
  render(<AppDownloadLink variant="nav" />);
  fireEvent.click(await screen.findByRole("link", { name: "앱 다운로드" }));
  expect(open).toHaveBeenCalledWith(
    new URL(DESKTOP_INSTALLERS.windows[0].href, window.location.href).href,
    "_blank",
    "noopener,noreferrer"
  );
  expect(push).toHaveBeenCalledWith("/download");
  expect(order).toEqual(["download", "page"]);
});

it("Mac은 CPU 선택 메뉴 없이 Apple Silicon 파일로 연결합니다", async () => {
  vi.mocked(desktopDownload).mockResolvedValue({
    os: "mac",
    href: DESKTOP_INSTALLERS.mac[0].href,
  });
  render(<AppDownloadLink />);
  expect(
    await screen.findByRole("link", { name: "macOS 다운로드" })
  ).toHaveAttribute("href", DESKTOP_INSTALLERS.mac[0].href);
  expect(screen.queryByRole("menu")).toBeNull();
});
