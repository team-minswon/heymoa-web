import { describe, expect, it } from "vitest";

import type { NoteResponseData } from "@/lib/api/generated/models";
import { buildNoteHeaderMeta } from "@/lib/notes/note-header-meta";

function note(overrides: Partial<NoteResponseData> = {}): NoteResponseData {
  return {
    noteId: "01K0000000002",
    title: "주간 제품 회의",
    projectId: "01K0000000001",
    createdAt: "2026-07-30T00:00:00Z",
    updatedAt: "2026-07-30T00:00:00Z",
    meetingStatus: "IN_PROGRESS",
    meetingStartedBy: {
      userId: "user-1",
      name: "김서연",
      email: "seoyeon@heymoa.com",
      image: null,
    },
    meetingStartedAt: "2026-07-30T00:00:00Z",
    recordedDurationMs: 2_520_000,
    activeSessionStartedAt: "2026-07-30T00:00:00Z",
    participants: [
      { userId: "user-1", name: "김서연", email: "a@b.c", image: null },
      { userId: "user-2", name: "박준호", email: "d@e.f", image: null },
    ],
    ...overrides,
  } as NoteResponseData;
}

describe("buildNoteHeaderMeta", () => {
  it("첫 줄은 참석자 수와 회의 시각이다", () => {
    const meta = buildNoteHeaderMeta(note(), { isStarter: true });

    expect(meta.participantLabel).toBe("참석자 2명");
    // 시각은 Asia/Seoul 기준이다 — 00:00Z는 같은 날 9시다. 오전/AM 표기는 런타임의 ICU
    // 데이터에 달려 있어(vitest는 축약 데이터로 돈다) 문자열째로 못 박지 않는다.
    expect(meta.whenLabel).toMatch(/^2026년 7월 30일 .*9:00$/);
    // `<time datetime>`이 그대로 쓰는 값이라 원본 ISO여야 한다.
    expect(meta.whenIso).toBe("2026-07-30T00:00:00Z");
  });

  it("시작 전에는 시작 시각이 없으니 생성 시각을 쓴다", () => {
    const { whenLabel, whenIso, secondary } = buildNoteHeaderMeta(
      note({
        meetingStatus: "NOT_STARTED",
        meetingStartedAt: null,
        meetingStartedBy: null,
        recordedDurationMs: 0,
        activeSessionStartedAt: null,
      }),
      { isStarter: false }
    );

    // 시작 시각이 없으면 생성 시각으로 떨어진다.
    expect(whenIso).toBe("2026-07-30T00:00:00Z");
    expect(whenLabel).toContain("2026년 7월 30일");
    expect(secondary).toBe("아직 시작하지 않았습니다");
  });

  it("기록 중 · 시작자에게는 공개 범위만 말한다", () => {
    expect(buildNoteHeaderMeta(note(), { isStarter: true }).secondary).toBe(
      "워크스페이스 멤버에게 공개"
    );
  });

  it("기록 중 · 참관에게는 누가 기록 중인지 먼저 말한다", () => {
    expect(buildNoteHeaderMeta(note(), { isStarter: false }).secondary).toBe(
      "김서연님이 기록 중 · 워크스페이스 멤버에게 공개"
    );
  });

  it("종료·중지는 누적 기록 시간이다", () => {
    const ended = buildNoteHeaderMeta(
      note({ meetingStatus: "ENDED", activeSessionStartedAt: null }),
      { isStarter: true }
    );
    expect(ended.secondary).toBe("기록 42분 (종료 세션 누적)");

    const paused = buildNoteHeaderMeta(
      note({
        meetingStatus: "PAUSED",
        activeSessionStartedAt: null,
        recordedDurationMs: 720_000,
      }),
      { isStarter: true }
    );
    expect(paused.secondary).toBe("기록 12분 (종료 세션 누적)");
  });

  it("참석자가 없으면 그 조각을 뺀다 — 「참석자 0명」은 정보가 아니다", () => {
    expect(
      buildNoteHeaderMeta(note({ participants: [] }), { isStarter: true })
        .participantLabel
    ).toBeNull();
  });

  it("진행 중 회의도 시계를 읽지 않는다 — 하이드레이션이 어긋난다", () => {
    // 같은 노트를 두 번 접으면 언제 접었는지와 무관하게 같은 문자열이어야 한다.
    const first = buildNoteHeaderMeta(note({ meetingStatus: "ENDED" }), {
      isStarter: true,
    });
    const second = buildNoteHeaderMeta(note({ meetingStatus: "ENDED" }), {
      isStarter: true,
    });
    expect(first).toEqual(second);
  });
});
