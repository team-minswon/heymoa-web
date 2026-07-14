import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NoteListRow } from "@/components/workspace/note-list-row";

vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => ({
    session: {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "ACTIVE",
    },
    phase: "recording",
    elapsedMs: 12_000,
    levelHistory: [0.1, 0.25, 0.7, 0.4, 0.2],
  }),
}));

describe("NoteListRow", () => {
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
        }}
      />
    );

    expect(screen.getAllByText("모바일 앱")).toHaveLength(2);
    expect(screen.getByText("00:12")).toBeInTheDocument();
    expect(
      screen.getByRole("meter", { name: "주간 제품 회의 마이크 입력" })
    ).toBeInTheDocument();
    expect(screen.getByText("기록 중")).toBeInTheDocument();
  });
});
