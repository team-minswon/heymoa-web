import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PreEndGuide } from "@/components/notes/pre-end-guide";
import type { NoteResponseData } from "@/lib/api/generated/models";

vi.mock("@/components/notes/meeting-end-dialog", () => ({
  MeetingEndDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="end-dialog" /> : null,
}));

const note = (overrides: Partial<NoteResponseData>) =>
  ({
    noteId: "01K0000000002",
    title: "회의",
    meetingStatus: "PAUSED",
    participants: [{ participantId: "p1", name: "나" }],
    ...overrides,
  }) as unknown as NoteResponseData;

describe("PreEndGuide", () => {
  afterEach(cleanup);

  it("일시정지됨이면 종료 버튼이 있고 이어서 녹음할 수 없다고 알린다", () => {
    render(<PreEndGuide note={note({})} />);
    expect(
      screen.getByText("종료한 뒤에는 이어서 녹음할 수 없어요.")
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    expect(screen.getByTestId("end-dialog")).toBeTruthy();
  });

  it("기록 중에는 종료 버튼을 두지 않고 일시정지부터 하라고 알린다", () => {
    render(<PreEndGuide note={note({ meetingStatus: "IN_PROGRESS" })} />);
    expect(screen.queryByRole("button", { name: "회의 종료" })).toBeNull();
    expect(
      screen.getByText("기록을 일시정지하면 회의를 종료할 수 있어요.")
    ).toBeTruthy();
  });

  it("참여자가 1명이면 추가를 안내한다", () => {
    const onEdit = vi.fn();
    render(<PreEndGuide note={note({})} onEditParticipants={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: "참여자 추가" }));
    expect(onEdit).toHaveBeenCalled();
  });

  it("참여자가 둘 이상이면 추가 안내를 안 한다", () => {
    render(
      <PreEndGuide
        note={note({
          participants: [
            { participantId: "p1", name: "나" },
            { participantId: "p2", name: "너" },
          ] as unknown as NoteResponseData["participants"],
        })}
        onEditParticipants={vi.fn()}
      />
    );
    expect(screen.queryByTestId("pre-end-guide-participants")).toBeNull();
  });
});
