import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopAppEntry } from "@/components/workspace/desktop-app-entry";
import { TooltipProvider } from "@/components/ui/tooltip";

const desktop = vi.hoisted(() => ({ value: false as boolean | null }));
const track = vi.hoisted(() => vi.fn());

vi.mock("@/lib/desktop/use-desktop-app", () => ({
  useDesktopApp: () => desktop.value,
}));
vi.mock("@/lib/analytics/track", () => ({ track }));

function renderEntry() {
  return render(
    <TooltipProvider>
      <DesktopAppEntry />
    </TooltipProvider>
  );
}

describe("DesktopAppEntry", () => {
  beforeEach(() => {
    desktop.value = false;
  });
  afterEach(() => {
    cleanup();
    track.mockReset();
  });

  it("브라우저에서는 다운로드 링크와 차이 보기 버튼을 둔다", () => {
    renderEntry();
    const link = screen.getByRole("link", { name: "데스크톱 앱 받기" });
    expect(link).toHaveAttribute("href", "/download");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(track).toHaveBeenCalledWith("desktop_download_clicked");
    expect(screen.getByRole("button", { name: "웹과 데스크톱 앱의 차이 보기" })).toBeInTheDocument();
  });

  it.each([true, null])("앱 안이거나 아직 모르면(%s) 그리지 않는다", (value) => {
    desktop.value = value;
    renderEntry();
    expect(screen.queryByRole("link", { name: "데스크톱 앱 받기" })).toBeNull();
  });

  it("차이 보기 창은 세 장을 넘겨 보고 닫으면 처음으로 돌아간다", () => {
    renderEntry();
    fireEvent.click(screen.getByRole("button", { name: "웹과 데스크톱 앱의 차이 보기" }));
    expect(screen.getByText("웹과 데스크톱 앱, 무엇이 다른가요?")).toBeInTheDocument();
    expect(screen.getByTestId("slide-sound")).toBeInTheDocument();
    expect(screen.getByText("내 목소리만 기록합니다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /이전/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    expect(screen.getByTestId("slide-menubar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    expect(screen.getByTestId("slide-install")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다운로드 페이지로" })).toHaveAttribute("href", "/download");

    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    fireEvent.click(screen.getByRole("button", { name: "웹과 데스크톱 앱의 차이 보기" }));
    expect(screen.getByTestId("slide-sound")).toBeInTheDocument();
  });

  it("점으로 원하는 장으로 바로 간다", () => {
    renderEntry();
    fireEvent.click(screen.getByRole("button", { name: "웹과 데스크톱 앱의 차이 보기" }));
    fireEvent.click(screen.getByRole("tab", { name: /3번째/ }));
    expect(screen.getByTestId("slide-install")).toBeInTheDocument();
  });
});
