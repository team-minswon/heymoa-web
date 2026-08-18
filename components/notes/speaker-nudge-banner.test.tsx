import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

function speaker(partial: Record<string, unknown> = {}) {
  return {
    label: "A",
    assignedUserId: null,
    displayName: "화자 A",
    confirmed: false,
    ...partial,
  };
}

const onRegenerate = vi.fn();
const onGoToTranscript = vi.fn();

function renderBanner(diarization: Record<string, unknown> | null) {
  state.diarization = diarization;
  return render(
    <SpeakerNudgeBanner
      noteId="01K0000000002"
      onRegenerate={onRegenerate}
      isRegenerating={false}
      onGoToTranscript={onGoToTranscript}
    />
  );
}

describe("SpeakerNudgeBanner", () => {
  afterEach(() => {
    cleanup();
    onRegenerate.mockClear();
    onGoToTranscript.mockClear();
  });

  // 분리가 도는 몇 분이 화자를 아는 사람이 아직 앉아 있는 유일한 시간이다.
  // 그때 화면이 아무 말도 안 하면 화자 기능이 없는 줄 알고 닫는다.
  it.each(["ASSEMBLING", "SUBMITTED"])("%s 이면 나누는 중이라고 말한다", (status) => {
    renderBanner({ status, speakers: [] });

    expect(screen.getByTestId("speaker-nudge-pending")).toBeTruthy();
  });

  it("실패하면 사실만 말하고 버튼을 안 준다 — 할 수 있는 일이 없다", () => {
    renderBanner({ status: "FAILED", speakers: [] });

    expect(screen.getByText(/화자를 나누지 못했습니다/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("아직 분리를 안 걸었으면 아무것도 안 낸다", () => {
    const { container } = renderBanner(null);

    expect(container.firstChild).toBeNull();
  });

  it("나눴는데 화자가 없으면 아무것도 안 낸다", () => {
    const { container } = renderBanner({ status: "MAPPED", speakers: [] });

    expect(container.firstChild).toBeNull();
  });

  // **여기가 이 컴포넌트의 이유다.** 전원 확인을 조건으로 두면, 셋 중 하나를 모르는
  // 사람은 「참석자 아님」이라고 답할 수도 없어 카운트가 영영 안 줄고 버튼이 안 나온다.
  it("셋 중 하나만 이름을 붙여도 다시 만들기가 나온다", () => {
    renderBanner({
      status: "MAPPED",
      speakers: [
        speaker({ label: "A", assignedUserId: "01K0000000009", confirmed: true }),
        speaker({ label: "B" }),
        speaker({ label: "C" }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /다시 만들기/ }));

    expect(onRegenerate).toHaveBeenCalled();
    expect(screen.getByText(/화자 2명의 이름을 확인하면/)).toBeTruthy();
  });

  it("아무도 이름이 없으면 다시 만들기를 숨긴다 — 반영할 이름이 없다", () => {
    renderBanner({
      status: "MAPPED",
      speakers: [speaker({ label: "A" }), speaker({ label: "B" })],
    });

    expect(screen.queryByRole("button", { name: /다시 만들기/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /대화 기록에서 확인하기/ }));
    expect(onGoToTranscript).toHaveBeenCalled();
  });

  // 「참석자 아님」도 확인이다. 남은 사람이 0 이면 데려다줄 곳이 없다.
  it("전원 확인이 끝나면 데려다주기가 사라진다", () => {
    renderBanner({
      status: "MAPPED",
      speakers: [
        speaker({ label: "A", assignedUserId: "01K0000000009", confirmed: true }),
        speaker({ label: "B", confirmed: true }),
      ],
    });

    expect(screen.queryByRole("button", { name: /대화 기록/ })).toBeNull();
    expect(screen.getByRole("button", { name: /다시 만들기/ })).toBeTruthy();
  });
});
