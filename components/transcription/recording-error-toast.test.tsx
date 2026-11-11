import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecordingErrorToast } from "@/components/transcription/recording-error-toast";

const recording = vi.hoisted(() => ({
  error: null as string | null,
  quotaExceeded: false,
  activeWorkspaceId: null as string | null,
}));
const workspace = vi.hoisted(() => ({
  state: { isSuccess: true, isError: false, data: undefined as unknown },
}));
const push = vi.hoisted(() => vi.fn());
const track = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), dismiss: vi.fn() }));
const desktop = vi.hoisted(() => ({ enabled: false }));
const openSitePage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/desktop/use-desktop-app", () => ({
  useDesktopApp: () => desktop.enabled,
}));
vi.mock("@/lib/desktop/open-site-page", () => ({ openSitePage }));

vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording,
}));

vi.mock("@/lib/ui/toast", () => ({ toast }));
// 「해결 방법」이 데스크톱 앱에서는 앱 안에서 이동한다(openSitePage) — 라우터만 있으면 된다
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  useGetWorkspace: () => workspace.state,
}));
vi.mock("@/lib/analytics/track", () => ({ track }));

describe("RecordingErrorToast", () => {
  beforeEach(() => {
    recording.error = null;
    recording.quotaExceeded = false;
    recording.activeWorkspaceId = null;
    workspace.state = { isSuccess: true, isError: false, data: undefined };
    push.mockReset();
    track.mockReset();
    toast.error.mockReset();
    toast.dismiss.mockReset();
    desktop.enabled = false;
    openSitePage.mockReset();
  });

  it("shows a recording failure once without inserting layout content", () => {
    const view = render(<RecordingErrorToast />);
    expect(view.container).toBeEmptyDOMElement();

    recording.error = "실시간 스크립트 연결이 중단되었습니다.";
    view.rerender(<RecordingErrorToast />);

    // 사유는 이제 이 토스트가 유일한 통로다(독에는 다시 시도만 남는다) — 자동으로 닫히면
    // 무엇을 고쳐야 하는지 알 길이 사라지므로 사용자가 닫을 때까지 띄워 둔다.
    expect(toast.error).toHaveBeenCalledWith(
      "실시간 스크립트 연결이 중단되었습니다.",
      {
        id: "recording-error",
        duration: Infinity,
        // 권한 거부처럼 사용자가 고칠 수 있는 사유는 도움말의 막힐 때 항목으로 보낸다
        action: expect.objectContaining({ label: "해결 방법" }),
      }
    );
    expect(view.container).toBeEmptyDOMElement();
  });

  it("복구되면 남아 있던 토스트를 닫는다", () => {
    recording.error = "실시간 스크립트 연결이 중단되었습니다.";
    const view = render(<RecordingErrorToast />);

    recording.error = null;
    view.rerender(<RecordingErrorToast />);

    expect(toast.dismiss).toHaveBeenCalledWith("recording-error");
  });

  it("데스크톱 오류의 해결 방법은 앱 권한 안내로 이동합니다", () => {
    desktop.enabled = true;
    recording.error = "소리를 연결하지 못했습니다.";
    render(<RecordingErrorToast />);
    toast.error.mock.calls.at(-1)![1].action.onClick();
    expect(openSitePage).toHaveBeenCalledWith(
      "/help/start/desktop#first-run",
      expect.any(Function)
    );
  });

  describe("무료 월 한도로 시작이 거절됐을 때", () => {
    const QUOTA = "이번 달 무료 녹음 시간을 모두 사용했습니다.";
    const asRole = (role: "ADMIN" | "MEMBER") => {
      recording.error = QUOTA;
      recording.quotaExceeded = true;
      recording.activeWorkspaceId = "W1";
      workspace.state = {
        isSuccess: true,
        isError: false,
        data: { status: 200, data: { success: true, data: { role } } },
      };
    };

    it("ADMIN 은 요금제 탭을 여는 액션을 받고 누르면 설정 창의 요금제 탭이 열린다", () => {
      window.history.replaceState(null, "", "/w/W1");
      asRole("ADMIN");
      render(<RecordingErrorToast />);
      const [message, options] = toast.error.mock.calls.at(-1)!;
      expect(message).toBe(QUOTA);
      expect(options.action.label).toBe("요금제 보기");
      expect(options.description).toBeUndefined();
      expect(track).toHaveBeenCalledTimes(1);
      expect(track).toHaveBeenCalledWith("recording_quota_blocked", {
        workspace_id: "W1",
        role: "admin",
      });

      options.action.onClick();
      // 설정 창은 같은 화면 안의 상태라 라우터가 아니라 주소의 `?settings=` 로 연다.
      expect(push).not.toHaveBeenCalled();
      expect(`${window.location.pathname}${window.location.search}`).toBe(
        "/w/W1?settings=billing"
      );
      expect(track).toHaveBeenLastCalledWith(
        "recording_quota_upgrade_clicked",
        {
          workspace_id: "W1",
        }
      );
    });

    it("멤버는 액션 없이 관리자에게 요청하라는 안내를 받는다", () => {
      asRole("MEMBER");
      render(<RecordingErrorToast />);
      const [message, options] = toast.error.mock.calls.at(-1)!;
      expect(message).toBe(QUOTA);
      expect(options.action).toBeUndefined();
      expect(options.description).toBe("관리자에게 Pro 전환을 요청하세요");
      expect(track).toHaveBeenCalledWith("recording_quota_blocked", {
        workspace_id: "W1",
        role: "member",
      });
    });

    it("다시 그려도 노출 이벤트는 한 번이고 사용량·회의 식별자를 싣지 않는다", () => {
      asRole("ADMIN");
      const view = render(<RecordingErrorToast />);
      view.rerender(<RecordingErrorToast />);
      view.rerender(<RecordingErrorToast />);
      expect(track).toHaveBeenCalledTimes(1);
      expect(Object.keys(track.mock.calls[0][1]).sort()).toEqual([
        "role",
        "workspace_id",
      ]);
    });

    it("역할을 알기 전에는 안내도 이벤트도 내지 않는다", () => {
      asRole("ADMIN");
      workspace.state = { isSuccess: false, isError: false, data: undefined };
      render(<RecordingErrorToast />);
      expect(toast.error).not.toHaveBeenCalled();
      expect(track).not.toHaveBeenCalled();
    });
  });
});
