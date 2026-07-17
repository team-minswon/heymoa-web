import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecordingErrorToast } from "@/components/transcription/recording-error-toast";

const recording = vi.hoisted(() => ({ error: null as string | null }));
const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording,
}));

vi.mock("sonner", () => ({ toast }));

describe("RecordingErrorToast", () => {
  beforeEach(() => {
    recording.error = null;
    toast.error.mockReset();
  });

  it("shows a recording failure once without inserting layout content", () => {
    const view = render(<RecordingErrorToast />);
    expect(view.container).toBeEmptyDOMElement();

    recording.error = "실시간 전사 연결이 중단되었습니다.";
    view.rerender(<RecordingErrorToast />);

    expect(toast.error).toHaveBeenCalledWith(
      "실시간 전사 연결이 중단되었습니다.",
      { id: "recording-error" }
    );
    expect(view.container).toBeEmptyDOMElement();
  });
});
