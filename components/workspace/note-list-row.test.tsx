import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NoteListRow } from "@/components/workspace/note-list-row";

type RecordingMock = {
  session: {
    sessionId: string;
    noteId: string;
    status: string;
  } | null;
  phase: string;
  elapsedMs: number;
};

type RecordingMeterMock = {
  levelHistory: number[];
};

const recording = vi.hoisted(() => ({
  current: {
    session: {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "ACTIVE",
    },
    phase: "recording",
    elapsedMs: 12_000,
  } as RecordingMock,
  meter: {
    levelHistory: [0.1, 0.25, 0.7, 0.4, 0.2],
  } as RecordingMeterMock,
}));

vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording.current,
  useRecordingMeter: () => recording.meter,
}));

describe("NoteListRow", () => {
  beforeEach(() => {
    recording.current = {
      session: {
        sessionId: "01K0000000010",
        noteId: "01K0000000002",
        status: "ACTIVE",
      },
      phase: "recording",
      elapsedMs: 12_000,
    };
    recording.meter = {
      levelHistory: [0.1, 0.25, 0.7, 0.4, 0.2],
    };
  });

  it("shows project metadata and live recording activity", () => {
    render(
      <NoteListRow
        workspaceId="01K0000000000"
        projectName="모바일 앱"
        note={{
          noteId: "01K0000000002",
          projectId: "01K0000000001",
          title: "주간 제품 회의",
          createdAt: "2026-07-11T00:00:00Z",
          updatedAt: "2026-07-11T00:00:00Z",
          lastRecordedAt: "2026-07-11T00:00:00Z",
          recordedDurationMs: 65_000,
    meetingStartedBy: null,
        }}
      />
    );

    expect(screen.getAllByText("모바일 앱")).toHaveLength(1);
    expect(screen.getByText("00:12")).toBeInTheDocument();
    expect(
      screen.getByRole("meter", { name: "주간 제품 회의 마이크 입력" })
    ).toBeInTheDocument();
    expect(screen.getByText("기록 중")).toBeInTheDocument();
    expect(screen.queryByText("01:05")).not.toBeInTheDocument();
  });

  it("shows persisted recording duration when the note is inactive", () => {
    recording.current = {
      session: null,
      phase: "completed",
      elapsedMs: 0,
    };
    recording.meter = {
      levelHistory: [0, 0, 0, 0, 0],
    };

    render(
      <NoteListRow
        workspaceId="01K0000000000"
        note={{
          noteId: "01K0000000002",
          projectId: "01K0000000001",
          title: "주간 제품 회의",
          createdAt: "2026-07-11T00:00:00Z",
          updatedAt: "2026-07-11T00:00:00Z",
          lastRecordedAt: "2026-07-11T00:00:00Z",
          recordedDurationMs: 65_000,
    meetingStartedBy: null,
        }}
      />
    );

    expect(screen.getByText("01:05")).toBeInTheDocument();
    expect(screen.queryByText("--:--")).not.toBeInTheDocument();
  });
});
