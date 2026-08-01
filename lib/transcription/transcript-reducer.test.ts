import { describe, expect, it } from "vitest";
import {
  initialTranscriptState,
  transcriptReducer,
} from "@/lib/transcription/transcript-reducer";

describe("transcriptReducer", () => {
  it("replaces partial snapshots for the same utterance", () => {
    const first = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "첫 snapshot",
    });
    const second = transcriptReducer(first, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "누적 snapshot",
    });

    expect(second.partial).toEqual({
      utteranceId: "0HZX2K7M9Q4AC",
      text: "누적 snapshot",
    });
  });

  it("removes a partial when its final arrives and marks completion", () => {
    const partial = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "안녕하세요",
    });
    const final = transcriptReducer(partial, {
      type: "final",
      transcriptionSessionId: "0HZX2K7M9Q4AB",
      segmentId: "0HZX2K7M9Q4AD",
      utteranceId: "0HZX2K7M9Q4AC",
      sequence: 1,
      text: "안녕하세요",
      startedAtMs: 0,
      endedAtMs: 1200,
    });
    const completed = transcriptReducer(final, {
      type: "completed",
      sessionId: "0HZX2K7M9Q4AB",
    });

    expect(final.partial).toBeNull();
    expect(final.finalSegments).toHaveLength(1);
    expect(completed.partial).toBeNull();
    expect(completed.completed).toBe(true);
  });

  it("drops unfinished and late partials once the session completes", () => {
    const partial = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "완료 직전 문장",
    });
    const completed = transcriptReducer(partial, {
      type: "completed",
      sessionId: "0HZX2K7M9Q4AB",
    });

    expect(
      transcriptReducer(completed, {
        type: "partial",
        utteranceId: "0HZX2K7M9Q4AC",
        text: "늦게 도착한 문장",
      })
    ).toEqual(completed);
  });

  it("clears an unfinished partial when a recording fails", () => {
    const partial = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "저장되지 않은 문장",
    });

    expect(
      transcriptReducer(partial, { type: "clear-partials" }).partial
    ).toBeNull();
  });

  it("replaces the previous utterance when a new utteranceId arrives", () => {
    // 계약(asyncapi PartialEvent): 새 utteranceId가 확정된 발화의 partial을 지우는 기준이다.
    // 맵으로 쌓으면 final을 못 받은 발화가 남아 이후 발화에 계속 이어 붙는다.
    const first = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "안녕하세요 오늘은",
    });
    const next = transcriptReducer(first, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AE",
      text: "다음 안건은",
    });

    expect(next.partial).toEqual({
      utteranceId: "0HZX2K7M9Q4AE",
      text: "다음 안건은",
    });
  });

  it("id가 더 이른 final이 와도 현재 partial을 비운다", () => {
    // utteranceId는 최신성을 뜻하지 않는다 — 서버가 재연결 때 폐기한 commit의 이전 id를
    // 되살린다. id 순서로 남길지 판단하면 죽은 partial이 세션 끝까지 남는다.
    // 너무 일찍 비우는 대가는 다음 snapshot이 곧 채우는 것뿐이다.
    const live = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AE",
      text: "다음 안건은",
    });

    const final = transcriptReducer(live, {
      type: "final",
      transcriptionSessionId: "0HZX2K7M9Q4AB",
      segmentId: "0HZX2K7M9Q4AD",
      utteranceId: "0HZX2K7M9Q4AC",
      sequence: 1,
      text: "안녕하세요 오늘은",
      startedAtMs: 0,
      endedAtMs: 1200,
    });

    expect(final.partial).toBeNull();
    expect(final.finalSegments).toHaveLength(1);
  });

  it("더 나중 발화의 final이 오면 앞선 고아 partial도 지운다", () => {
    // 계약은 "partial이 한 번도 오지 않는 발화"를 허용한다. 고아 A 뒤의 발화 B가 partial
    // 없이 final만 내면, id가 같은 경우만 지워서는 A가 영영 남는다.
    const orphan = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "확정되지 못한 문장",
    });

    const laterFinal = transcriptReducer(orphan, {
      type: "final",
      transcriptionSessionId: "0HZX2K7M9Q4AB",
      segmentId: "0HZX2K7M9Q4AD",
      utteranceId: "0HZX2K7M9Q4AE",
      sequence: 1,
      text: "다음 발화의 확정",
      startedAtMs: 0,
      endedAtMs: 1200,
    });

    expect(laterFinal.partial).toBeNull();
  });

  it("resets all live state before a new session", () => {
    const previous = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "이전 세션",
    });

    expect(transcriptReducer(previous, { type: "reset" })).toEqual(
      initialTranscriptState
    );
  });

  // 변이 감사에서 나온 구멍: dedupe 필터의 `!==` 를 `===` 로 뒤집어도 아무 테스트가
  // 안 잡았다. 서버가 같은 segmentId 로 final 을 다시 보내면(재연결 drain) 화면에
  // 같은 문장이 두 번 남거나, 반대로 쌓인 것이 전부 사라진다.
  it("같은 segmentId 의 final 이 다시 오면 대체한다 — 쌓지 않는다", () => {
    const first = transcriptReducer(initialTranscriptState, {
      type: "final",
      transcriptionSessionId: "0HZX2K7M9Q4AB",
      segmentId: "0HZX2K7M9Q4AD",
      utteranceId: "0HZX2K7M9Q4AC",
      sequence: 1,
      text: "처음 확정",
      startedAtMs: 0,
      endedAtMs: 1200,
    });
    const again = transcriptReducer(first, {
      type: "final",
      transcriptionSessionId: "0HZX2K7M9Q4AB",
      segmentId: "0HZX2K7M9Q4AD",
      utteranceId: "0HZX2K7M9Q4AC",
      sequence: 1,
      text: "고쳐진 확정",
      startedAtMs: 0,
      endedAtMs: 1200,
    });

    expect(again.finalSegments).toHaveLength(1);
    expect(again.finalSegments[0].text).toBe("고쳐진 확정");
  });

  it("다른 segmentId 의 final 은 기존 것을 지우지 않는다", () => {
    const first = transcriptReducer(initialTranscriptState, {
      type: "final",
      transcriptionSessionId: "0HZX2K7M9Q4AB",
      segmentId: "0HZX2K7M9Q4AD",
      utteranceId: "0HZX2K7M9Q4AC",
      sequence: 1,
      text: "첫 문장",
      startedAtMs: 0,
      endedAtMs: 1200,
    });
    const second = transcriptReducer(first, {
      type: "final",
      transcriptionSessionId: "0HZX2K7M9Q4AB",
      segmentId: "0HZX2K7M9Q4AE",
      utteranceId: "0HZX2K7M9Q4AF",
      sequence: 2,
      text: "둘째 문장",
      startedAtMs: 1200,
      endedAtMs: 2400,
    });

    expect(second.finalSegments.map((s) => s.text)).toEqual([
      "첫 문장",
      "둘째 문장",
    ]);
  });
});
