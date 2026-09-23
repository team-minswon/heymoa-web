import { describe, expect, it } from "vitest";

import { parseNoteTopicEvent } from "@/lib/notes/note-topic-protocol";

describe("노트 토픽 이벤트", () => {
  // 여기서 파싱이 실패하면 `try{}catch{}` 가 무음으로 삼킨다 — 이벤트만 사라지고
  // 안전 폴링이 버티므로 눈에 안 보이고, 그래서 더 오래 산다.
  it("모르는 필드가 붙어도 이벤트가 살아 있고 그 필드는 버려진다", () => {
    const parsed = parseNoteTopicEvent(
      JSON.stringify({
        type: "recording.stopped",
        transcriptionSessionId: "0HZX2K7M9Q4AB",
        meetingStatus: "IN_PROGRESS",
        recordedDurationMs: 90_000,
      })
    );

    expect(parsed).toMatchObject({
      type: "recording.stopped",
      transcriptionSessionId: "0HZX2K7M9Q4AB",
    });
    expect(parsed).not.toHaveProperty("recordedDurationMs");
  });

  it("payload 가 없던 이벤트에 payload 가 생겨도 견딘다", () => {
    expect(() =>
      parseNoteTopicEvent(
        JSON.stringify({ type: "meeting.ended", meetingStatus: "ENDED" })
      )
    ).not.toThrow();
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
