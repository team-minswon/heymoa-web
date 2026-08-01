import { describe, expect, it } from "vitest";

import type { NoteSummary } from "@/lib/api/generated/models";
import {
  groupNotesByMonth,
  timelineAnchorOf,
} from "@/lib/workspace/timeline-groups";

function note(
  noteId: string,
  createdAt: string,
  scheduledAt: string | null = null
): NoteSummary {
  return {
    noteId,
    projectId: "01K0000000001",
    title: noteId,
    createdAt,
    updatedAt: createdAt,
    scheduledAt,
    participants: [],
    analysisStatus: "NONE",
    previousNote: null,
    lastRecordedAt: null,
    meetingStatus: "NOT_STARTED",
    meetingStartedAt: null,
    meetingStartedBy: null,
    activeSessionStartedAt: null,
    recordedDurationMs: 0,
  };
}

describe("timelineAnchorOf", () => {
  it("예정이 있으면 예정 시각이다", () => {
    expect(
      timelineAnchorOf(
        note("a", "2026-07-01T00:00:00Z", "2026-08-05T00:00:00Z")
      )
    ).toBe("2026-08-05T00:00:00Z");
  });

  it("예정이 없으면 만든 시각이다 — 시작 전 회의도 축에 놓인다", () => {
    expect(timelineAnchorOf(note("a", "2026-07-01T00:00:00Z"))).toBe(
      "2026-07-01T00:00:00Z"
    );
  });
});

describe("groupNotesByMonth", () => {
  it("월로 묶고 최신이 위다", () => {
    const groups = groupNotesByMonth(
      [
        note("july", "2026-07-11T00:00:00Z"),
        note("august", "2026-08-03T00:00:00Z"),
        note("june", "2026-06-27T00:00:00Z"),
      ],
      "2026"
    );

    expect(groups.map((group) => group.monthKey)).toEqual([
      "2026-08",
      "2026-07",
      "2026-06",
    ]);
  });

  it("올해는 연도를 붙이지 않고 다른 해만 붙인다", () => {
    // 같은 해가 이어지는데 매번 「2026년」을 반복하면 해가 바뀌는 지점이 안 보인다.
    const groups = groupNotesByMonth(
      [note("now", "2026-08-03T00:00:00Z"), note("old", "2025-12-20T00:00:00Z")],
      "2026"
    );

    expect(groups.map((group) => group.label)).toEqual(["8월", "2025년 12월"]);
  });

  it("묶음 안에서 최신이 위다", () => {
    const groups = groupNotesByMonth(
      [
        note("early", "2026-08-01T00:00:00Z"),
        note("late", "2026-08-20T00:00:00Z"),
      ],
      "2026"
    );

    expect(groups[0].notes.map((row) => row.noteId)).toEqual([
      "late",
      "early",
    ]);
  });

  it("예정 시각이 묶음을 정한다 — 만든 달이 아니다", () => {
    const groups = groupNotesByMonth(
      [note("a", "2026-07-01T00:00:00Z", "2026-09-05T00:00:00Z")],
      "2026"
    );

    expect(groups[0].monthKey).toBe("2026-09");
  });

  it("월 경계를 서울 기준으로 가른다", () => {
    // 2026-08-01T00:00+09:00 은 UTC 로는 7월 31일이다. UTC 로 자르면 8월 회의가
    // 7월 묶음에 들어가 사용자가 자기 달력과 다른 것을 본다.
    const groups = groupNotesByMonth([note("kst", "2026-07-31T15:00:00Z")], "2026");
    expect(groups[0].monthKey).toBe("2026-08");
  });

  it("빈 목록은 빈 배열이다", () => {
    expect(groupNotesByMonth([], "2026")).toEqual([]);
  });
});
