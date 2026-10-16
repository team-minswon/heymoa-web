import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopAppPromo } from "@/components/workspace/desktop-app-promo";
import { TooltipProvider } from "@/components/ui/tooltip";

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

  it("브라우저에서는 온라인 회의 안내와 다운로드 링크를 보여 준다", async () => {
    render(
      <TooltipProvider>
        <DesktopAppPromo />
      </TooltipProvider>
    );
    expect(
      screen.getByText(
        "회의실 대화도, 화상회의·강의·유튜브에서 듣는 말도 기록하세요."
      )
    ).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: "앱 다운로드" });
    expect(link).toHaveAttribute("href", "/download?start=1");
    expect(link).toHaveAttribute("target", "_blank");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(track).toHaveBeenCalledWith("desktop_download_clicked");
  });

  it.each([true, null])(
    "앱 안이거나 아직 모르면(%s) 그리지 않는다",
    (value) => {
      desktop.value = value;
      render(
        <TooltipProvider>
          <DesktopAppPromo />
        </TooltipProvider>
      );
      expect(
        screen.queryByText(
          "회의실 대화도, 화상회의·강의·유튜브에서 듣는 말도 기록하세요."
        )
      ).toBeNull();
    }
  );

  it("이전에 배너를 닫았어도 항상 표시하고 닫기 버튼은 두지 않는다", () => {
    window.localStorage.setItem("heymoa:desktop-promo-dismissed", "1");
    render(
      <TooltipProvider>
        <DesktopAppPromo />
      </TooltipProvider>
    );
    expect(
      screen.getByRole("complementary", { name: "데스크톱 앱 안내" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "데스크톱 앱 안내 닫기" })
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "웹과 앱의 차이" })
    ).toBeInTheDocument();
  });

  it("물음표로 녹음 차이와 앱 사용법을 세 단계로 살펴보고 앱을 받을 수 있다", async () => {
    render(
      <TooltipProvider>
        <DesktopAppPromo />
      </TooltipProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "웹과 앱의 차이" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "기록할 수 있는 소리" })
    ).toBeInTheDocument();
    const microphone = within(
      dialog.getByRole("row", { name: /마이크로 들어오는 소리/ })
    );
    expect(microphone.getAllByText("기록 가능")).toHaveLength(2);
    const computer = within(
      dialog.getByRole("row", { name: /컴퓨터에서 재생되는 소리/ })
    );
    expect(computer.getByText("기록되지 않음")).toBeInTheDocument();
    expect(computer.getByText("기록 가능")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "다음" }));
    expect(
      dialog.getByRole("heading", { name: "창을 닫아도 이어지는 녹음" })
    ).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "다음" }));
    expect(
      dialog.getByRole("heading", { name: "사용하던 기록 그대로" })
    ).toBeInTheDocument();
    expect(
      await dialog.findByRole("link", { name: "앱 다운로드" })
    ).toHaveAttribute("target", "_blank");
    fireEvent.click(dialog.getByRole("button", { name: "확인" }));
    fireEvent.click(screen.getByRole("button", { name: "웹과 앱의 차이" }));
    expect(
      screen.getByRole("heading", { name: "기록할 수 있는 소리" })
    ).toBeInTheDocument();
  });
});
