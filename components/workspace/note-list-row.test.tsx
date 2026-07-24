import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteListRow } from "@/components/workspace/note-list-row";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";

const recording = vi.hoisted(() => ({
  current: {
    session: { sessionId: "01K0000000010", noteId: "01K0000000002", status: "ACTIVE" } as
      | { sessionId: string; noteId: string; status: string }
      | null,
    activeNoteId: "01K0000000002" as string | undefined,
    phase: "recording",
    elapsedMs: 12_000,
  },
  meter: { levelHistory: [0.1, 0.25, 0.7, 0.4, 0.2] },
}));

vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording.current,
  useRecordingMeter: () => recording.meter,
}));

function note(): NoteListResponseDataNotesItem {
  return {
    noteId: "01K0000000002",
    projectId: "01K0000000001",
    title: "주간 제품 회의",
    createdAt: "2026-07-11T00:00:00Z",
    updatedAt: "2026-07-11T00:00:00Z",
    lastRecordedAt: "2026-07-11T00:00:00Z",
    recordedDurationMs: 65_000,
    meetingStartedBy: null,
  };
}

describe("NoteListRow", () => {
  afterEach(cleanup);
  beforeEach(() => {
    recording.current = {
      session: { sessionId: "01K0000000010", noteId: "01K0000000002", status: "ACTIVE" },
      activeNoteId: "01K0000000002",
      phase: "recording",
      elapsedMs: 12_000,
    };
    recording.meter = { levelHistory: [0.1, 0.25, 0.7, 0.4, 0.2] };
  });

  it("renders a flat row with a live meter while recording", () => {
    render(<NoteListRow workspaceId="01K0000000000" note={note()} />);

    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "주간 제품 회의 노트 열기" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("meter", { name: "주간 제품 회의 마이크 입력" })
    ).toBeInTheDocument();
  });

  it("shows no meter, badge, or duration when inactive (v5 flat row)", () => {
    recording.current = {
      session: null,
      activeNoteId: undefined,
      phase: "completed",
      elapsedMs: 0,
    };
    recording.meter = { levelHistory: [0, 0, 0, 0, 0] };

    render(<NoteListRow workspaceId="01K0000000000" note={note()} />);

    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(screen.queryByRole("meter")).toBeNull();
    // 카드 시절 잔재(녹음 시간·"기록 중")는 v5 행에 없다.
    expect(screen.queryByText("01:05")).toBeNull();
    expect(screen.queryByText("기록 중")).toBeNull();
  });
});
