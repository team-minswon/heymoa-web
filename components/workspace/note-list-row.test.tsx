import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

function renderRow(row: NoteListResponseDataNotesItem, now?: number) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NoteListRow workspaceId="01K0000000000" note={row} now={now} />
    </QueryClientProvider>
  );
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
    renderRow(note());

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

    renderRow(note());

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

    renderRow(note({
          meetingStatus,
          activeSessionStartedAt:
            meetingStatus === "IN_PROGRESS" ? "2026-07-11T00:22:41Z" : null,
          meetingStartedBy: { userId: "01K0000000099", name: "김민수" },
        }), Date.parse("2026-07-11T00:23:41Z"));

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("uses cumulative active-only time instead of wall time since the first start", () => {
    renderRow(note({
          recordedDurationMs: 120_000,
          activeSessionStartedAt: "2026-07-11T00:22:41Z",
          meetingStartedAt: "2026-07-01T00:00:00Z",
          meetingStartedBy: { userId: "01K0000000099", name: "김민수" },
        }), Date.parse("2026-07-11T00:23:41Z"));

    expect(screen.getByText("3분")).toBeInTheDocument();
    expect(screen.queryByText(/\d{4,}분/)).toBeNull();
  });

  it("freezes PAUSED duration and keeps its starter readable", () => {
    renderRow(note({
          meetingStatus: "PAUSED",
          activeSessionStartedAt: null,
          recordedDurationMs: 185_000,
          meetingStartedBy: { userId: "01K0000000099", name: "김민수" },
        }), Date.parse("2026-08-11T00:23:41Z"));

    expect(screen.getByText("중지됨")).toBeInTheDocument();
    expect(screen.getByText("김민수")).toBeInTheDocument();
    expect(screen.getByText("기록 3분")).toBeInTheDocument();
  });

  it("lets narrow rows keep title width and hides secondary live detail below sm", () => {
    renderRow(note({
          recordedDurationMs: 120_000,
          activeSessionStartedAt: "2026-07-11T00:22:41Z",
          meetingStartedBy: { userId: "01K0000000099", name: "김민수" },
        }), Date.parse("2026-07-11T00:23:41Z"));

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
  it("기록 중이 아닌 회의는 메뉴에서 삭제할 수 있다", async () => {
    recording.current = {
      session: null,
      activeNoteId: undefined,
      phase: "idle",
      elapsedMs: 0,
    };
    renderRow(note({ meetingStatus: "ENDED", activeSessionStartedAt: null }));

    fireEvent.click(
      screen.getByRole("button", { name: "주간 제품 회의 노트 메뉴" })
    );

    await waitFor(() => {
      expect(screen.getByText("삭제")).toBeInTheDocument();
    });
  });

  it("기록 중인 회의에는 삭제를 안 그린다", async () => {
    renderRow(note({ meetingStatus: "IN_PROGRESS" }));

    fireEvent.click(
      screen.getByRole("button", { name: "주간 제품 회의 노트 메뉴" })
    );

    // 서버가 409로 막는 자리라 눌러서 실패하게 두지 않는다.
    await waitFor(() => {
      expect(screen.getByText("전체 화면으로 열기")).toBeInTheDocument();
    });
    expect(screen.queryByText("삭제")).toBeNull();
  });
});
