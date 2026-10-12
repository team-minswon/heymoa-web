import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecordingErrorToast } from "@/components/transcription/recording-error-toast";

const recording = vi.hoisted(() => ({ error: null as string | null }));
const toast = vi.hoisted(() => ({ error: vi.fn(), dismiss: vi.fn() }));

vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording,
}));

vi.mock("@/lib/ui/toast", () => ({ toast }));
// 「해결 방법」이 데스크톱 앱에서는 앱 안에서 이동한다(openSitePage) — 라우터만 있으면 된다
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("RecordingErrorToast", () => {
  beforeEach(() => {
    recording.error = null;
    toast.error.mockReset();
    toast.dismiss.mockReset();
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
});
