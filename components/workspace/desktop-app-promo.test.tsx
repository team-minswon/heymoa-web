import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopAppPromo } from "@/components/workspace/desktop-app-promo";

const desktop = vi.hoisted(() => ({ value: false as boolean | null }));
const track = vi.hoisted(() => vi.fn());

vi.mock("@/lib/desktop/use-desktop-app", () => ({
  useDesktopApp: () => desktop.value,
}));
vi.mock("@/lib/analytics/track", () => ({ track }));

describe("DesktopAppPromo", () => {
  beforeEach(() => {
    desktop.value = false;
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    track.mockReset();
  });

  it("브라우저에서는 온라인 회의 안내와 다운로드 링크를 보여 준다", () => {
    render(<DesktopAppPromo />);
    expect(screen.getByText("온라인 회의도 기록하세요")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "데스크톱 앱 받기" });
    expect(link).toHaveAttribute("href", "/download");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(track).toHaveBeenCalledWith("desktop_download_clicked");
  });

  it("? 버튼으로 웹과 앱의 차이 창을 연다", () => {
    render(<DesktopAppPromo />);
    fireEvent.click(screen.getByRole("button", { name: "웹과 데스크톱 앱의 차이 보기" }));
    expect(screen.getByText("웹과 데스크톱 앱, 무엇이 다른가요?")).toBeInTheDocument();
    expect(screen.getByTestId("slide-sound")).toBeInTheDocument();
  });

  it.each([true, null])("앱 안이거나 아직 모르면(%s) 그리지 않는다", (value) => {
    desktop.value = value;
    render(<DesktopAppPromo />);
    expect(screen.queryByText("온라인 회의도 기록하세요")).toBeNull();
  });

  it("닫으면 사라지고 이 브라우저에서는 다시 보이지 않는다", () => {
    const { unmount } = render(<DesktopAppPromo />);
    fireEvent.click(screen.getByRole("button", { name: "데스크톱 앱 안내 닫기" }));
    expect(screen.queryByText("온라인 회의도 기록하세요")).toBeNull();
    unmount();
    render(<DesktopAppPromo />);
    expect(screen.queryByText("온라인 회의도 기록하세요")).toBeNull();
  });

  it("저장이 막혀도 그리고 닫을 수 있다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<DesktopAppPromo />);
    expect(screen.getByText("온라인 회의도 기록하세요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "데스크톱 앱 안내 닫기" }));
    expect(screen.queryByText("온라인 회의도 기록하세요")).toBeNull();
  });
});
