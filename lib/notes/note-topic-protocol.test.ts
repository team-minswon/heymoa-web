import { describe, expect, it } from "vitest";

import {
  NOTE_SUBSCRIPTION_FEEDBACK_DESTINATION,
  parseNoteSubscriptionRejected,
  parseNoteTopicEvent,
} from "@/lib/notes/note-topic-protocol";

describe("노트 토픽 이벤트", () => {
  it("회의 생애 필드는 보존하고, 여전히 모르는 필드는 버린다", () => {
    const parsed = parseNoteTopicEvent(
      JSON.stringify({
        type: "recording.stopped",
        transcriptionSessionId: "0HZX2K7M9Q4AB",
        meetingStatus: "PAUSED",
        meetingStartedAt: "2026-08-18T10:00:00.000Z",
        recordedDurationMs: 90_000,
        activeSessionStartedAt: null,
        unknown: "ignored",
      })
    );

    expect(parsed).toMatchObject({
      type: "recording.stopped",
      transcriptionSessionId: "0HZX2K7M9Q4AB",
      meetingStatus: "PAUSED",
      meetingStartedAt: "2026-08-18T10:00:00.000Z",
      recordedDurationMs: 90_000,
      activeSessionStartedAt: null,
    });
    expect(parsed).not.toHaveProperty("unknown");
  });

  it("payload 가 없던 이벤트에 payload 가 생겨도 견딘다", () => {
    expect(parseNoteTopicEvent('{"type":"meeting.ended"}')).toEqual({
      type: "meeting.ended",
    });
  });

  it("관대함은 모르는 필드까지다 — 아는 필드의 깨진 값은 그대로 거절한다", () => {
    expect(() =>
      parseNoteTopicEvent(
        '{"type":"recording.started","transcriptionSessionId":"짧다"}'
      )
    ).toThrow();
    expect(() => parseNoteTopicEvent('{"type":"nope"}')).toThrow();
  });
});

describe("구독 거절 통지", () => {
  // 노트 토픽이 아니라 사용자 queue 로 온다 — 거절당한 구독은 서버에 등록되지 않았다.
  it("사유 셋을 읽는다", () => {
    for (const reason of [
      "NOT_MEMBER",
      "ALREADY_SUBSCRIBED",
      "TOO_MANY_SUBSCRIBERS",
    ]) {
      expect(
        parseNoteSubscriptionRejected(
          JSON.stringify({
            type: "subscription.rejected",
            noteId: "0HZX2K7M9Q4AB",
            reason,
          })
        ).reason
      ).toBe(reason);
    }
    expect(NOTE_SUBSCRIPTION_FEEDBACK_DESTINATION).toBe(
      "/user/queue/note-subscriptions"
    );
  });

  it("모르는 사유는 거절한다 — 화면이 다르게 행동해야 하는 값이라 흘려보내면 안 된다", () => {
    expect(() =>
      parseNoteSubscriptionRejected(
        '{"type":"subscription.rejected","noteId":"0HZX2K7M9Q4AB","reason":"NOPE"}'
      )
    ).toThrow();
  });
});
