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
import { intlWrapper } from "@/components/help/test-intl";

const desktop = vi.hoisted(() => ({ value: false as boolean | null }));
const recording = vi.hoisted(() => ({
  phase: "idle",
  buffer: null as { pendingMs: number } | null,
}));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording,
}));
const track = vi.hoisted(() => vi.fn());

vi.mock("@/lib/desktop/use-desktop-app", () => ({
  useDesktopApp: () => desktop.value,
}));
vi.mock("@/lib/analytics/track", () => ({ track }));

describe("DesktopAppPromo", () => {
  beforeEach(() => {
    desktop.value = false;
    recording.phase = "idle";
    recording.buffer = null;
    Reflect.deleteProperty(window, "heymoaDesktop");
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "heymoaDesktop");
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
        "회의실 대화도, 화상회의와 강의, 유튜브에서 듣는 말도 기록하세요."
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
          "회의실 대화도, 화상회의와 강의, 유튜브에서 듣는 말도 기록하세요."
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
  it("영어 화면에서는 안내와 비교 창이 영어로 보인다", async () => {
    const { baseElement } = render(
      <TooltipProvider>
        <DesktopAppPromo />
      </TooltipProvider>,
      { wrapper: intlWrapper("en") }
    );
    expect(
      await screen.findByRole("link", { name: "Download app" })
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Compare the web and desktop apps" })
    );
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "What you can record" })
    ).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Next" }));
    fireEvent.click(dialog.getByRole("button", { name: "Next" }));
    expect(
      dialog.getByRole("heading", { name: "Keep using your existing notes" })
    ).toBeInTheDocument();
    // 공용 Dialog 의 닫기 버튼(`components/ui/dialog.tsx`)은 이 모듈 문구가 아니다.
    expect(baseElement.textContent?.replace("닫기", "")).not.toMatch(/[가-힣]/);
  });
});

describe("legacy desktop update notice", () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "heymoaDesktop");
    vi.restoreAllMocks();
  });
  function oldApp(version: string, platform = "Windows NT 10.0; Win64; x64") {
    desktop.value = true;
    recording.phase = "idle";
    recording.buffer = null;
    Object.defineProperty(window, "heymoaDesktop", {
      configurable: true,
      value: { getCapabilities: vi.fn() },
    });
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      `Mozilla/5.0 (${platform}) HeyMoa/${version} Electron/44.5.1`
    );
  }
  it.each(["0.1.2", "0.1.3"])(
    "%s gets exactly one notice with a direct Windows installer link and no unsupported native calls",
    (version) => {
      oldApp(version);
      render(<DesktopAppPromo />);
      expect(
        screen.getAllByRole("complementary", { name: "앱 업데이트 안내" })
      ).toHaveLength(1);
      expect(
        screen.getByText(new RegExp(`현재 앱 ${version}`))
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "새 설치 파일 받기" })
      ).toHaveAttribute(
        "href",
        "https://github.com/team-minswon/homebrew-tap/releases/latest/download/HeyMoa-win-x64.exe"
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("complementary", { name: "데스크톱 앱 안내" })
      ).not.toBeInTheDocument();
    }
  );
  it("Mac gets the canonical Apple Silicon DMG, not the internal URL old shells cannot open", () => {
    oldApp("0.1.2", "Macintosh; Intel Mac OS X 10_15_7");
    render(<DesktopAppPromo />);
    expect(
      screen.getByRole("link", { name: "새 설치 파일 받기" })
    ).toHaveAttribute(
      "href",
      "https://github.com/team-minswon/homebrew-tap/releases/latest/download/HeyMoa-mac-arm64.dmg"
    );
  });
  it("hides the legacy notice as soon as the native updater is supported", () => {
    oldApp("0.1.4");
    Object.assign(
      (window as unknown as { heymoaDesktop: object }).heymoaDesktop,
      {
        getUpdateState() {},
        checkForUpdates() {},
        setAutomaticUpdates() {},
        restartForUpdate() {},
        subscribeUpdates() {},
      }
    );
    render(<DesktopAppPromo />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
  it("recording and pending audio block the download action until drained", () => {
    oldApp("0.1.3");
    const view = render(<DesktopAppPromo />);
    for (const phase of [
      "requesting-permission",
      "connecting",
      "recording",
      "stopping",
    ]) {
      recording.phase = phase;
      view.rerender(<DesktopAppPromo />);
      expect(
        screen.getByRole("button", { name: "새 설치 파일 받기" })
      ).toBeDisabled();
      expect(
        screen.queryByRole("link", { name: "새 설치 파일 받기" })
      ).not.toBeInTheDocument();
    }
    recording.phase = "failed";
    recording.buffer = { pendingMs: 1000 };
    view.rerender(<DesktopAppPromo />);
    expect(
      screen.getByRole("button", { name: "새 설치 파일 받기" })
    ).toBeDisabled();
    recording.buffer = null;
    view.rerender(<DesktopAppPromo />);
    expect(
      screen.getByRole("link", { name: "새 설치 파일 받기" })
    ).toBeInTheDocument();
  });
  it("English guidance stays in English and is an inline notice", () => {
    oldApp("0.1.2");
    render(<DesktopAppPromo />, { wrapper: intlWrapper("en") });
    expect(
      screen.getByRole("complementary", { name: "App update notice" })
    ).not.toHaveTextContent(/[가-힣]/);
    expect(
      screen.getByRole("link", { name: "Download new installer" })
    ).toHaveAttribute("target", "_blank");
  });
});
