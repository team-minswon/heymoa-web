import { describe, expect, it } from "vitest";

import { groupNotesByRecency } from "@/lib/workspace/note-groups";

function note(meetingStartedAt: string) {
  return { meetingStartedAt, createdAt: meetingStartedAt };
}

describe("groupNotesByRecency", () => {
  it("날짜 하나가 묶음 하나이고 라벨에 요일이 붙는다", () => {
    const groups = groupNotesByRecency([
      note("2026-07-27T01:00:00Z"),
      note("2026-07-26T01:00:00Z"),
    ]);

    expect(groups.map((group) => group.label)).toEqual([
      "2026년 7월 27일 (월)",
      "2026년 7월 26일 (일)",
    ]);
  });

  it("같은 날짜는 한 묶음으로 합치고 입력 순서를 지킨다", () => {
    const groups = groupNotesByRecency([
      note("2026-07-27T05:00:00Z"),
      note("2026-07-27T01:00:00Z"),
      note("2026-07-26T01:00:00Z"),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].notes).toHaveLength(2);
    expect(groups[0].notes[0].meetingStartedAt).toBe("2026-07-27T05:00:00Z");
  });

  it("KST 자정을 넘긴 UTC 시각은 그 다음 날로 묶는다", () => {
    // 2026-07-26T16:30Z = KST 2026-07-27 01:30 → 27일 묶음이다.
    const groups = groupNotesByRecency([
      note("2026-07-26T16:30:00Z"),
      note("2026-07-26T10:00:00Z"),
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      "2026-07-27",
      "2026-07-26",
    ]);
  });

  it("기록한 적 없는 노트는 만든 날로 묶는다", () => {
    const groups = groupNotesByRecency([
      { meetingStartedAt: null, createdAt: "2026-07-27T01:00:00Z" },
    ]);

    expect(groups.map((group) => group.key)).toEqual(["2026-07-27"]);
  });

  // 제목만 고쳐도 `updatedAt`이 오늘로 바뀌어 지난주 회의가 오늘 묶음으로 옮겨갔다.
  it("마지막으로 고친 시각은 묶음에 영향을 주지 않는다", () => {
    const groups = groupNotesByRecency([
      {
        meetingStartedAt: "2026-07-27T01:00:00Z",
        createdAt: "2026-07-27T00:00:00Z",
        updatedAt: "2026-08-09T00:00:00Z",
      },
    ]);

    expect(groups.map((group) => group.key)).toEqual(["2026-07-27"]);
  });

  it("빈 목록은 묶음도 없다", () => {
    expect(groupNotesByRecency([])).toEqual([]);
  });
});
