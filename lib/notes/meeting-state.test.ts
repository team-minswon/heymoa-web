import { describe, expect, it } from "vitest";

import {
  deriveMeetingPhase,
  isMeetingActive,
  isPersonalChatHiddenInNote,
  MEETING_POLL_MS,
  meetingRefetchInterval,
} from "@/lib/notes/meeting-state";

const startedBy = { userId: "01K0000000001", name: "테스트 유저" };

describe("deriveMeetingPhase", () => {
  it("IN_PROGRESS + 시작자 있으면 활성", () => {
    expect(
      deriveMeetingPhase({ meetingStatus: "IN_PROGRESS", meetingStartedBy: startedBy })
    ).toBe("active");
  });

  it("IN_PROGRESS인데 시작자 없으면 미시작 — 회의가 열린 게 아니다", () => {
    // 계약: 새 노트는 생성 시부터 IN_PROGRESS라 startedBy=null이 "아직 미개시"를 가른다.
    expect(
      deriveMeetingPhase({ meetingStatus: "IN_PROGRESS", meetingStartedBy: null })
    ).toBe("not-started");
  });

  it("PAUSED는 중지", () => {
    expect(
      deriveMeetingPhase({ meetingStatus: "PAUSED", meetingStartedBy: startedBy })
    ).toBe("paused");
  });

  it("ENDED는 종료", () => {
    expect(
      deriveMeetingPhase({ meetingStatus: "ENDED", meetingStartedBy: startedBy })
    ).toBe("ended");
  });

  it("노트를 아직 못 읽었으면 unknown", () => {
    expect(deriveMeetingPhase(undefined)).toBe("unknown");
  });
});

describe("meetingRefetchInterval", () => {
  it("종료 전에는 폴링하고 종료되면 멈춘다", () => {
    expect(
      meetingRefetchInterval({ meetingStatus: "IN_PROGRESS", meetingStartedBy: startedBy })
    ).toBe(MEETING_POLL_MS);
    expect(
      meetingRefetchInterval({ meetingStatus: "PAUSED", meetingStartedBy: startedBy })
    ).toBe(MEETING_POLL_MS);
    expect(
      meetingRefetchInterval({ meetingStatus: "ENDED", meetingStartedBy: startedBy })
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
    // 중지·종료는 개인 챗봇을 남긴다.
    expect(isPersonalChatHiddenInNote("full", "paused", false)).toBe(false);
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
    expect(
      isMeetingActive({ meetingStatus: "IN_PROGRESS", meetingStartedBy: startedBy })
    ).toBe(true);
    expect(
      isMeetingActive({ meetingStatus: "IN_PROGRESS", meetingStartedBy: null })
    ).toBe(false);
    expect(isMeetingActive(undefined)).toBe(false);
  });
});
