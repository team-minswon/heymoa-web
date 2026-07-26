import { describe, expect, it } from "vitest";

import { groupNotesByRecency } from "@/lib/workspace/note-groups";

// 기준 시각: 2026-07-26(일) 12:00 KST. 라벨 경계를 이 날짜에서 센다.
const NOW = Date.parse("2026-07-26T03:00:00Z");

function note(updatedAt: string) {
  return { updatedAt };
}

describe("groupNotesByRecency", () => {
  it("now가 없으면 묶지 않는다 — SSR과 첫 렌더가 같아야 한다", () => {
    const notes = [note("2026-07-26T02:00:00Z"), note("2026-06-01T02:00:00Z")];

    const groups = groupNotesByRecency(notes, null);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBeNull();
    expect(groups[0].notes).toHaveLength(2);
  });

  it("오늘·어제·이번 주·지난주·이번 달·연월로 가른다", () => {
    const groups = groupNotesByRecency(
      [
        note("2026-07-26T01:00:00Z"), // 오늘
        note("2026-07-25T01:00:00Z"), // 어제
        note("2026-07-22T01:00:00Z"), // 4일 전 → 이번 주
        note("2026-07-16T01:00:00Z"), // 10일 전 → 지난주
        note("2026-07-02T01:00:00Z"), // 같은 달 → 이번 달
        note("2026-05-02T01:00:00Z"), // 그 이전 → 연월
      ],
      NOW
    );

    expect(groups.map((group) => group.label)).toEqual([
      "오늘",
      "어제",
      "이번 주",
      "지난주",
      "이번 달",
      "2026년 5월",
    ]);
  });

  it("같은 라벨은 한 묶음으로 합치고 입력 순서를 지킨다", () => {
    const groups = groupNotesByRecency(
      [
        note("2026-07-26T05:00:00Z"),
        note("2026-07-26T01:00:00Z"),
        note("2026-07-25T01:00:00Z"),
      ],
      NOW
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].notes).toHaveLength(2);
    expect(groups[0].notes[0].updatedAt).toBe("2026-07-26T05:00:00Z");
  });

  it("KST 자정을 넘긴 UTC 시각도 그 날짜로 센다", () => {
    // 2026-07-25T16:30Z = KST 2026-07-26 01:30 → '오늘'이다.
    const groups = groupNotesByRecency([note("2026-07-25T16:30:00Z")], NOW);

    expect(groups[0].label).toBe("오늘");
  });

  it("빈 목록은 묶음도 없다", () => {
    expect(groupNotesByRecency([], NOW)).toEqual([]);
  });

  it("이번 주·지난주는 달력 주로 가른다 — 롤링 6일이 아니다", () => {
    // 2026-07-27(월) 기준. 이틀 전인 25일(토)은 날짜 차이로는 가깝지만 **지난주**다.
    const monday = Date.parse("2026-07-27T03:00:00Z");

    const groups = groupNotesByRecency(
      [
        note("2026-07-27T01:00:00Z"), // 월 → 오늘
        note("2026-07-26T01:00:00Z"), // 일 → 어제
        note("2026-07-25T01:00:00Z"), // 토 → 지난주 (같은 주가 아니다)
        note("2026-07-13T01:00:00Z"), // 두 주 전 → 이번 달
      ],
      monday
    );

    expect(groups.map((group) => group.label)).toEqual([
      "오늘",
      "어제",
      "지난주",
      "이번 달",
    ]);
  });
});
