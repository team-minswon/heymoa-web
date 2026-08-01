import { describe, expect, it } from "vitest";

import {
  groupTranscriptSegments,
  resolveSpeakerName,
  type TranscriptPresentationSegment,
} from "@/lib/transcription/presentation";

function segment(
  segmentId: string,
  transcriptionSessionId: string,
  sequence: number,
  text: string,
  startedAtMs: number,
  endedAtMs: number,
  speaker: string | null = null
): TranscriptPresentationSegment {
  return {
    segmentId,
    transcriptionSessionId,
    sequence,
    text,
    startedAtMs,
    endedAtMs,
    speaker,
  };
}

describe("groupTranscriptSegments", () => {
  it("merges adjacent segments from the same session into one presentation block", () => {
    const blocks = groupTranscriptSegments([
      segment("segment-1", "session-1", 1, " 첫 번째  문장입니다. ", 0, 800),
      segment("segment-2", "session-1", 2, "두 번째 문장입니다.", 1_000, 1_800),
    ]);

    expect(blocks).toEqual([
      expect.objectContaining({
        blockId: "segment-1",
        sessionId: "session-1",
        segmentIds: ["segment-1", "segment-2"],
        text: "첫 번째 문장입니다. 두 번째 문장입니다.",
        startedAtMs: 0,
        endedAtMs: 1_800,
      }),
    ]);
  });

  it("keeps session boundaries and carries the timeline into the next session", () => {
    const blocks = groupTranscriptSegments([
      segment("segment-1", "session-1", 1, "첫 세션", 0, 2_000),
      segment("segment-2", "session-2", 1, "다음 세션", 0, 900),
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      sessionId: "session-1",
      timelineStartedAtMs: 0,
      timelineEndedAtMs: 2_000,
    });
    expect(blocks[1]).toMatchObject({
      sessionId: "session-2",
      timelineStartedAtMs: 2_000,
      timelineEndedAtMs: 2_900,
    });
  });

  it("starts a new block when the silence gap is too large", () => {
    const blocks = groupTranscriptSegments([
      segment("segment-1", "session-1", 1, "앞 문장", 0, 500),
      segment("segment-2", "session-1", 2, "긴 침묵 뒤 문장", 2_001, 2_800),
    ]);

    expect(blocks.map((block) => block.segmentIds)).toEqual([
      ["segment-1"],
      ["segment-2"],
    ]);
  });

  it("starts a new block instead of exceeding the block text-length limit", () => {
    const longText = "가".repeat(250);
    const blocks = groupTranscriptSegments([
      segment("segment-1", "session-1", 1, longText, 0, 800),
      segment("segment-2", "session-1", 2, "나".repeat(20), 900, 1_600),
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks.map((block) => block.text)).toEqual([
      longText,
      "나".repeat(20),
    ]);
  });
});

describe("화자 분리", () => {
  it("화자가 바뀌면 시간이 붙어 있어도 블록을 나눈다", () => {
    // 붙어 있는 두 발화를 합치면 두 사람의 말이 한 사람 것으로 읽힌다.
    const blocks = groupTranscriptSegments([
      segment("s1", "session-1", 1, "먼저 진행 상황부터 볼까요.", 0, 900, "1"),
      segment("s2", "session-1", 2, "네, 제가 정리했습니다.", 1_000, 2_000, "2"),
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].speaker).toBe("1");
    expect(blocks[1].speaker).toBe("2");
  });

  it("같은 화자는 기존 규칙대로 합친다", () => {
    const blocks = groupTranscriptSegments([
      segment("s1", "session-1", 1, "먼저", 0, 400, "1"),
      segment("s2", "session-1", 2, "진행 상황부터 봅니다.", 600, 1_400, "1"),
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("먼저 진행 상황부터 봅니다.");
    expect(blocks[0].speaker).toBe("1");
  });

  it("화자 분리가 없던 구간은 null끼리 합쳐진다", () => {
    const blocks = groupTranscriptSegments([
      segment("s1", "session-1", 1, "먼저", 0, 400),
      segment("s2", "session-1", 2, "진행 상황부터 봅니다.", 600, 1_400),
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].speaker).toBeNull();
  });

  it("화자 분리 구간과 아닌 구간은 안 합친다", () => {
    const blocks = groupTranscriptSegments([
      segment("s1", "session-1", 1, "먼저", 0, 400, "1"),
      segment("s2", "session-1", 2, "진행 상황부터 봅니다.", 600, 1_400),
    ]);

    expect(blocks).toHaveLength(2);
  });
});

describe("resolveSpeakerName", () => {
  const assignments = [
    {
      transcriptionSessionId: "session-1",
      speaker: "1",
      displayName: "김서연",
    },
    { transcriptionSessionId: "session-1", speaker: "2", displayName: null },
  ];

  it("연결된 라벨은 이름으로 옮긴다", () => {
    expect(resolveSpeakerName("session-1", "1", assignments)).toBe("김서연");
  });

  it("연결이 없으면 「화자 N」이다", () => {
    expect(resolveSpeakerName("session-1", "2", assignments)).toBe("화자 2");
    expect(resolveSpeakerName("session-1", "3", assignments)).toBe("화자 3");
  });

  it("세션이 다르면 같은 번호라도 남의 연결을 쓰지 않는다", () => {
    // 제공자가 스트림마다 번호를 새로 매긴다 — 세션을 무시하면 엉뚱한 사람 이름이 붙는다.
    expect(resolveSpeakerName("session-2", "1", assignments)).toBe("화자 1");
  });

  it("화자 분리가 없던 구간은 이름이 없다", () => {
    expect(resolveSpeakerName("session-1", null, assignments)).toBeNull();
  });
});

// 변이 감사에서 나온 구멍: 합치기 조건의 `<=` 를 `<` 로 바꿔도 아무 테스트가 안 잡았다.
// 경계에서만 갈리는 값이라 딱 그 지점을 찌르지 않으면 안 보인다.
describe("합치기 경계", () => {
  it("간격이 정확히 상한(1500ms)이면 합친다", () => {
    const blocks = groupTranscriptSegments([
      segment("s1", "session-1", 1, "앞 문장", 0, 500),
      segment("s2", "session-1", 2, "뒤 문장", 2_000, 2_400),
    ]);

    expect(blocks).toHaveLength(1);
  });

  it("간격이 상한을 1ms 넘으면 나눈다", () => {
    const blocks = groupTranscriptSegments([
      segment("s1", "session-1", 1, "앞 문장", 0, 500),
      segment("s2", "session-1", 2, "뒤 문장", 2_001, 2_400),
    ]);

    expect(blocks).toHaveLength(2);
  });

  it("블록 길이가 정확히 상한(30초)이면 합친다", () => {
    const blocks = groupTranscriptSegments([
      segment("s1", "session-1", 1, "앞 문장", 0, 500),
      segment("s2", "session-1", 2, "뒤 문장", 1_800, 30_000),
    ]);

    expect(blocks).toHaveLength(1);
  });

  it("블록 길이가 상한을 1ms 넘으면 나눈다", () => {
    const blocks = groupTranscriptSegments([
      segment("s1", "session-1", 1, "앞 문장", 0, 500),
      segment("s2", "session-1", 2, "뒤 문장", 1_800, 30_001),
    ]);

    expect(blocks).toHaveLength(2);
  });

  it("글자 수가 정확히 상한(260)이면 합친다", () => {
    const a = "가".repeat(129);
    const b = "나".repeat(130);
    const blocks = groupTranscriptSegments([
      segment("s1", "session-1", 1, a, 0, 500),
      segment("s2", "session-1", 2, b, 800, 1_200),
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toHaveLength(260);
  });

  it("글자 수가 상한을 1자 넘으면 나눈다", () => {
    const a = "가".repeat(130);
    const b = "나".repeat(130);
    const blocks = groupTranscriptSegments([
      segment("s1", "session-1", 1, a, 0, 500),
      segment("s2", "session-1", 2, b, 800, 1_200),
    ]);

    expect(blocks).toHaveLength(2);
  });
});
