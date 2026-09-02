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

  // 분리가 도는 몇 분이 화자를 아는 사람이 아직 앉아 있는 유일한 시간이다.
  // 그때 화면이 아무 말도 안 하면 화자 기능이 없는 줄 알고 닫는다.
  it.each(["ASSEMBLING", "SUBMITTED"])("%s 이면 나누는 중이라고 말한다", (status) => {
    renderBanner({ status, speakers: [] });

    expect(screen.getByTestId("speaker-nudge-pending")).toBeTruthy();
  });

  it("실패하면 사실만 말한다 — 요약은 이미 있으니 할 일이 없다", () => {
    renderBanner({ status: "FAILED", speakers: [] });

    expect(screen.getByText(/화자를 나누지 못했습니다/)).toBeTruthy();
  });

  it("아직 분리를 안 걸었으면 아무것도 안 낸다", () => {
    const { container } = renderBanner(null);

    expect(container.firstChild).toBeNull();
  });

  // **권유를 여기 두지 않는다.** 이 컴포넌트는 요약을 못 읽어서, 이미 이름을 반영해
  // 만든 요약 위에도 「다시 만들 수 있습니다」를 영영 띄우고 있었다. 재생성은 요약 탭의
  // 고정 버튼이 맡는다.
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
