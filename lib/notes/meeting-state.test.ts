import { describe, expect, it } from "vitest";

import {
  deriveMeetingPhase,
  getRecordedDurationMs,
  isMeetingActive,
  isPersonalChatHiddenInNote,
  MEETING_PRIMARY_ACTION_LABEL,
  MEETING_STATUS_LABEL,
  meetingLengthOf,
  pausedDayCount,
  recordingClockOriginMs,
} from "@/lib/notes/meeting-state";

describe("deriveMeetingPhase", () => {
  it.each([
    {
      meetingStatus: "NOT_STARTED",
      expected: "not-started",
    },
    {
      meetingStatus: "IN_PROGRESS",
      expected: "active",
    },
    {
      meetingStatus: "PAUSED",
      expected: "paused",
    },
    {
      meetingStatus: "ENDED",
      expected: "ended",
    },
  ] as const)(
    "$meetingStatus 상태를 $expected 단계로 접는다",
    ({ meetingStatus, expected }) => {
      expect(deriveMeetingPhase({ meetingStatus })).toBe(expected);
    }
  );

  it("노트를 아직 못 읽었으면 unknown", () => {
    expect(deriveMeetingPhase(undefined)).toBe("unknown");
  });
});

describe("isPersonalChatHiddenInNote", () => {
  // 노트 안에서는 항상 감춘다. 전체 화면의 오른쪽 440은 공유 레일이 **상주**하는 자리라
  // (design.pen `L4PpR`), 개인 챗봇이 `fixed`로 그 위에 뜨면 챗 UI 둘이 겹친다.
  // 예전에는 종료되면 레일이 걷혀 그 자리를 개인 챗봇이 물려받는 규칙이었다.
  it.each([
    ["side", "active"],
    ["side", "ended"],
    ["full", "active"],
    ["full", "not-started"],
    ["full", "paused"],
    ["full", "ended"],
    ["full", "unknown"],
  ] as const)("%s + %s는 개인 챗봇을 감춘다", (view, phase) => {
    expect(phase).toBeTruthy();
    expect(isPersonalChatHiddenInNote(view)).toBe(true);
  });

  // 조회 실패도 예외가 아니다 — side는 시트가 z-50이라 개인 챗봇 FAB(z-40)이 그 아래 깔려
  // 보여도 못 누른다. 실패의 정상 경로는 노트 자신의 InlineRetry다.
  it("조회 실패도 예외로 두지 않는다", () => {
    expect(isPersonalChatHiddenInNote("full")).toBe(true);
    expect(isPersonalChatHiddenInNote("side")).toBe(true);
  });
});

describe("isMeetingActive", () => {
  it("활성일 때만 참", () => {
    expect(isMeetingActive({ meetingStatus: "IN_PROGRESS" })).toBe(true);
    expect(isMeetingActive({ meetingStatus: "PAUSED" })).toBe(false);
    expect(isMeetingActive(undefined)).toBe(false);
  });
});

describe("meeting presentation", () => {
  it.each([
    ["NOT_STARTED", "시작 전", "회의 시작"],
    ["IN_PROGRESS", "기록 중", "일시정지"],
    ["PAUSED", "일시정지됨", "재개"],
    ["ENDED", "종료됨", "요약 보기"],
  ] as const)("%s 문구와 주 액션을 제공한다", (status, label, action) => {
    expect(MEETING_STATUS_LABEL[status]).toBe(label);
    expect(MEETING_PRIMARY_ACTION_LABEL[status]).toBe(action);
  });
});

describe("getRecordedDurationMs", () => {
  const now = Date.parse("2026-07-29T10:00:30Z");

  it.each([
    ["NOT_STARTED", 60_000, "2026-07-29T10:00:00Z", 0],
    ["IN_PROGRESS", 60_000, "2026-07-29T10:00:00Z", 90_000],
    ["PAUSED", 60_000, "2026-07-29T10:00:00Z", 60_000],
    ["ENDED", 60_000, "2026-07-29T10:00:00Z", 60_000],
  ] as const)(
    "%s는 완료 구간과 현재 활성 구간만 합산한다",
    (meetingStatus, recordedDurationMs, activeSessionStartedAt, expected) => {
      expect(
        getRecordedDurationMs(
          { meetingStatus, recordedDurationMs, activeSessionStartedAt },
          now
        )
      ).toBe(expected);
    }
  );

  it.each([
    ["READY", null],
    ["미래", "2026-07-29T10:01:00Z"],
    ["잘못된 시각", "not-a-date"],
  ] as const)(
    "%s 활성 시각은 완료 구간에서 고정한다",
    (_, activeSessionStartedAt) => {
      expect(
        getRecordedDurationMs(
          {
            meetingStatus: "IN_PROGRESS",
            recordedDurationMs: 60_000,
            activeSessionStartedAt,
          },
          now
        )
      ).toBe(60_000);
    }
  );

  it.each([
    ["NaN", Number.NaN],
    ["양의 무한대", Number.POSITIVE_INFINITY],
    ["음의 무한대", Number.NEGATIVE_INFINITY],
    ["음수", -1],
  ])("%s 누적값을 0으로 정규화한다", (_, recordedDurationMs) => {
    expect(
      getRecordedDurationMs(
        {
          meetingStatus: "PAUSED",
          recordedDurationMs,
          activeSessionStartedAt: null,
        },
        now
      )
    ).toBe(0);
  });

  it("재개한 스냅샷은 이전 구간에 현재 구간만 더하고 다음 일시정지에서 고정한다", () => {
    const resumed = getRecordedDurationMs(
      {
        meetingStatus: "IN_PROGRESS",
        recordedDurationMs: 90_000,
        activeSessionStartedAt: "2026-07-29T10:00:00Z",
      },
      now
    );

    expect(resumed).toBe(120_000);
    expect(
      getRecordedDurationMs(
        {
          meetingStatus: "PAUSED",
          recordedDurationMs: resumed,
          activeSessionStartedAt: null,
        },
        Date.parse("2026-07-29T11:00:00Z")
      )
    ).toBe(120_000);
  });
});

describe("recordingClockOriginMs", () => {
  it("재개한 회의의 원점은 활성 세션 시작보다 앞 구간(회의 축 끝)만큼 이르다 — 시계가 0으로 돌아가지 않는다", () => {
    const resumed = {
      meetingStatus: "IN_PROGRESS" as const,
      recordedDurationMs: 20 * 60_000,
      activeSessionStartedAt: "2026-07-29T10:00:00Z",
    };
    const origin = Date.parse("2026-07-29T10:00:00Z") - 20 * 60_000;
    expect(recordingClockOriginMs(resumed)).toBe(origin);
    // 재개 5초 뒤 시계는 20:05 다. 스크립트 줄(회의 축)과 같은 수다.
    expect(
      getRecordedDurationMs(resumed, Date.parse("2026-07-29T10:00:05Z"))
    ).toBe(20 * 60_000 + 5_000);
  });

  it.each([
    ["PAUSED", "2026-07-29T10:00:00Z"],
    ["IN_PROGRESS", null],
    ["IN_PROGRESS", "not-a-date"],
  ] as const)("%s · %s 이면 잴 원점이 없다", (meetingStatus, startedAt) => {
    expect(
      recordingClockOriginMs({
        meetingStatus,
        recordedDurationMs: 60_000,
        activeSessionStartedAt: startedAt,
      })
    ).toBeNull();
  });
});

describe("meetingLengthOf", () => {
  const span = (endedAtMs: number) => ({ endedAtMs });

  it("서버 회의 축 끝이 원천이다", () => {
    expect(
      meetingLengthOf(90_000, {
        segments: [span(49_000)],
        gaps: [],
        transcriptGaps: [],
      } as never)
    ).toBe(90_000);
  });

  it("축 끝이 발화 · 소리 없는 구간 · 받아쓰지 못한 구간 끝보다 짧으면 그 끝까지 늘린다", () => {
    const transcript = {
      segments: [span(49_000)],
      gaps: [span(70_000)],
      transcriptGaps: [span(80_000)],
    } as never;
    expect(meetingLengthOf(10_000, transcript)).toBe(80_000);
    // 미시작 세션이 마지막에 정렬돼 0으로 온 옛 응답(APP-1432 이전)도 끝까지 그린다
    expect(meetingLengthOf(0, transcript)).toBe(80_000);
  });

  it("전사가 아직 없으면 축 끝 그대로다", () => {
    expect(meetingLengthOf(42_000, null)).toBe(42_000);
    expect(meetingLengthOf(undefined, undefined)).toBe(0);
  });
});

describe("pausedDayCount", () => {
  // KST 10월 22일 09:00
  const now = Date.parse("2026-10-22T00:00:00Z");

  it("앱 시간대 달력일로 세고 일시정지한 날이 1일째다", () => {
    // KST 10월 21일 23:30 — 9시간 반 전이지만 어제라 2일째
    expect(pausedDayCount("2026-10-21T14:30:00Z", now)).toBe(2);
    // KST 10월 19일
    expect(pausedDayCount("2026-10-19T05:00:00Z", now)).toBe(4);
  });

  it("오늘 일시정지했거나 시각을 모르면 날수를 말하지 않는다", () => {
    expect(pausedDayCount("2026-10-21T16:00:00Z", now)).toBeNull();
    expect(pausedDayCount(null, now)).toBeNull();
    expect(pausedDayCount("2026-10-19T05:00:00Z", null)).toBeNull();
  });
});
