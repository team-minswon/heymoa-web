import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SpeakerNudgeBanner } from "@/components/notes/speaker-nudge-banner";

const state = vi.hoisted(() => ({
  diarization: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/api/generated/transcription/transcription", () => ({
  useGetNoteTranscript: () => ({
    data: {
      status: 200,
      data: { success: true, data: { diarization: state.diarization } },
    },
  }),
}));

function renderBanner(diarization: Record<string, unknown> | null) {
  state.diarization = diarization;
  return render(<SpeakerNudgeBanner noteId="01K0000000002" />);
}

describe("SpeakerNudgeBanner", () => {
  afterEach(cleanup);

  it.each(["ASSEMBLING", "SUBMITTED"])(
    "%s 이면 나누는 중이라고 말한다",
    (status) => {
      renderBanner({ status, speakers: [] });

      expect(screen.getByTestId("speaker-nudge-pending")).toBeTruthy();
    }
  );

  it("실패하면 사실만 말한다 — 요약은 이미 있으니 할 일이 없다", () => {
    renderBanner({ status: "FAILED", speakers: [] });

    expect(screen.getByText(/화자를 나누지 못했습니다/)).toBeTruthy();
  });

  it("아직 분리를 안 걸었으면 아무것도 안 낸다", () => {
    const { container } = renderBanner(null);

    expect(container.firstChild).toBeNull();
  });

  it("나누기가 끝나면 아무것도 안 낸다 — 재생성을 권하지 않는다", () => {
    const { container } = renderBanner({
      status: "MAPPED",
      speakers: [
        { label: "A", confirmed: true },
        { label: "B", confirmed: false },
      ],
    });

    expect(container.firstChild).toBeNull();
  });
});
