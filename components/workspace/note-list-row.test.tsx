import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteListRow } from "@/components/workspace/note-list-row";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";

const recording = vi.hoisted(() => ({
  current: {
    session: {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "ACTIVE",
    } as { sessionId: string; noteId: string; status: string } | null,
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

function note(
  overrides: Partial<NoteListResponseDataNotesItem> = {}
): NoteListResponseDataNotesItem {
  return {
    noteId: "01K0000000002",
    projectId: "01K0000000001",
    title: "주간 제품 회의",
    createdAt: "2026-07-11T00:00:00Z",
    updatedAt: "2026-07-11T00:00:00Z",
    lastRecordedAt: "2026-07-11T00:00:00Z",
    recordedDurationMs: 65_000,
    activeSessionStartedAt: "2026-07-11T00:00:00Z",
    meetingStatus: "IN_PROGRESS",
    meetingStartedAt: "2026-07-11T00:00:00Z",
    meetingStartedBy: null,
    ...overrides,
  };
}

describe("NoteListRow", () => {
  afterEach(cleanup);
  beforeEach(() => {
    recording.current = {
      session: {
        sessionId: "01K0000000010",
        noteId: "01K0000000002",
        status: "ACTIVE",
      },
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

  it("shows no meter when the local recorder is inactive", () => {
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
    // 로컬 녹음 여부와 서버 회의 상태는 별개다.
    expect(screen.queryByText("01:05")).toBeNull();
    expect(screen.getByText("기록 중")).toBeInTheDocument();
  });

  it.each([
    ["NOT_STARTED", "시작 전"],
    ["IN_PROGRESS", "기록 중"],
    ["PAUSED", "중지됨"],
    ["ENDED", "종료됨"],
  ] as const)("shows the exact %s status copy", (meetingStatus, label) => {
    recording.current = {
      session: null,
      activeNoteId: undefined,
      phase: "idle",
      elapsedMs: 0,
    };

    render(
      <NoteListRow
        workspaceId="01K0000000000"
        note={note({
          meetingStatus,
          activeSessionStartedAt:
            meetingStatus === "IN_PROGRESS" ? "2026-07-11T00:22:41Z" : null,
          meetingStartedBy: { userId: "01K0000000099", name: "김민수" },
        })}
        now={Date.parse("2026-07-11T00:23:41Z")}
      />
    );

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("uses cumulative active-only time instead of wall time since the first start", () => {
    render(
      <NoteListRow
        workspaceId="01K0000000000"
        note={note({
          recordedDurationMs: 120_000,
          activeSessionStartedAt: "2026-07-11T00:22:41Z",
          meetingStartedAt: "2026-07-01T00:00:00Z",
          meetingStartedBy: { userId: "01K0000000099", name: "김민수" },
        })}
        now={Date.parse("2026-07-11T00:23:41Z")}
      />
    );

    expect(screen.getByText("3분")).toBeInTheDocument();
    expect(screen.queryByText(/\d{4,}분/)).toBeNull();
  });

  it("freezes PAUSED duration and keeps its starter readable", () => {
    render(
      <NoteListRow
        workspaceId="01K0000000000"
        note={note({
          meetingStatus: "PAUSED",
          activeSessionStartedAt: null,
          recordedDurationMs: 185_000,
          meetingStartedBy: { userId: "01K0000000099", name: "김민수" },
        })}
        now={Date.parse("2026-08-11T00:23:41Z")}
      />
    );

    expect(screen.getByText("중지됨")).toBeInTheDocument();
    expect(screen.getByText("김민수")).toBeInTheDocument();
    expect(screen.getByText("기록 3분")).toBeInTheDocument();
  });

  it("lets narrow rows keep title width and hides secondary live detail below sm", () => {
    render(
      <NoteListRow
        workspaceId="01K0000000000"
        note={note({
          recordedDurationMs: 120_000,
          activeSessionStartedAt: "2026-07-11T00:22:41Z",
          meetingStartedBy: { userId: "01K0000000099", name: "김민수" },
        })}
        now={Date.parse("2026-07-11T00:23:41Z")}
      />
    );

    const title = screen.getByRole("heading", { name: "주간 제품 회의" });
    const meta = screen.getByText("기록 중").parentElement;

    expect(title).toHaveClass("min-w-16");
    expect(meta).toHaveClass("shrink", "overflow-hidden");
    expect(meta).not.toHaveClass("shrink-0");
    expect(screen.getByText("김민수").parentElement).toHaveClass(
      "hidden",
      "sm:flex"
    );
    expect(screen.getByText("3분")).toHaveClass("hidden", "sm:inline");
    expect(screen.getByText("기록 중")).not.toHaveClass("hidden");
  });
});
