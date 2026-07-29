import { describe, expect, it } from "vitest";

import {
  deriveMeetingPhase,
  getRecordedDurationMs,
  isMeetingActive,
  isPersonalChatHiddenInNote,
  MEETING_POLL_MS,
  MEETING_PRIMARY_ACTION_LABEL,
  MEETING_STATUS_LABEL,
  meetingRefetchInterval,
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

describe("meetingRefetchInterval", () => {
  it("종료 전에는 폴링하고 종료되면 멈춘다", () => {
    expect(
      meetingRefetchInterval({
        meetingStatus: "IN_PROGRESS",
      })
    ).toBe(MEETING_POLL_MS);
    expect(
      meetingRefetchInterval({
        meetingStatus: "ENDED",
      })
    ).toBe(false);
  });
});

describe("isPersonalChatHiddenInNote", () => {
  it("side에서는 항상 감춘다", () => {
    expect(isPersonalChatHiddenInNote("side", "active", false)).toBe(true);
    expect(isPersonalChatHiddenInNote("side", "ended", false)).toBe(true);
  });

  it("full에서 트레이가 레일을 독차지할 때만 감춘다", () => {
    expect(isPersonalChatHiddenInNote("full", "active", false)).toBe(true);
    expect(isPersonalChatHiddenInNote("full", "not-started", false)).toBe(true);
    expect(isPersonalChatHiddenInNote("full", "paused", false)).toBe(true);
    expect(isPersonalChatHiddenInNote("full", "ended", false)).toBe(false);
  });

  it("unknown은 로딩 중에만 감추고, 실패면 개인 챗봇을 남긴다", () => {
    // 로딩(pending) → 트레이가 곧 뜨니 감춘다.
    expect(isPersonalChatHiddenInNote("full", "unknown", true)).toBe(true);
    // 실패(pending 아님) → 트레이도 안 서므로 감추면 챗 입구가 전무해진다.
    expect(isPersonalChatHiddenInNote("full", "unknown", false)).toBe(false);
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
    ["IN_PROGRESS", "기록 중", "중지"],
    ["PAUSED", "중지됨", "재개"],
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

  it("재개한 스냅샷은 이전 구간에 현재 구간만 더하고 다음 중지에서 고정한다", () => {
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
