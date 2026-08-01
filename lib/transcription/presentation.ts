export type TranscriptPresentationSegment = {
  segmentId: string;
  transcriptionSessionId?: string;
  sequence: number;
  text: string;
  startedAtMs: number;
  endedAtMs: number;
  /**
   * 제공자가 붙인 화자 라벨("1".."15"). 이름이 아니다. 화자 분리를 못 켠 구간은 null.
   *
   * **세션이 다르면 같은 번호가 같은 사람이라는 보장이 없다** — 제공자가 스트림마다
   * 번호를 새로 매긴다. 그래서 라벨만 보고 회의 전체를 가로질러 묶으면 안 된다.
   */
  speaker?: string | null;
};

export type SpeakerAssignment = {
  transcriptionSessionId: string;
  speaker: string;
  displayName: string | null;
};

/** 라벨을 화면에 쓸 이름으로 옮긴다. 연결이 없으면 「화자 N」이다. */
export function resolveSpeakerName(
  sessionId: string,
  speaker: string | null | undefined,
  assignments: readonly SpeakerAssignment[]
): string | null {
  if (speaker == null) return null;
  const hit = assignments.find(
    (row) =>
      row.transcriptionSessionId === sessionId && row.speaker === speaker
  );
  return hit?.displayName ?? `화자 ${speaker}`;
}

export type TranscriptBlock = {
  blockId: string;
  sessionId: string;
  /** 이 블록을 말한 화자의 제공자 라벨. 화자 분리가 없던 구간은 null. */
  speaker: string | null;
  segmentIds: string[];
  text: string;
  startedAtMs: number;
  endedAtMs: number;
  timelineStartedAtMs: number;
  timelineEndedAtMs: number;
};

const MAX_SEGMENTS_PER_BLOCK = 6;
const MAX_BLOCK_DURATION_MS = 30_000;
const MAX_GAP_MS = 1_500;
const MAX_BLOCK_TEXT_LENGTH = 260;

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function withContinuousTimeline(segments: TranscriptPresentationSegment[]) {
  let activeSessionId: string | null = null;
  let previousSessionsDurationMs = 0;
  let activeSessionDurationMs = 0;

  return segments.map((segment) => {
    const sessionId = segment.transcriptionSessionId ?? "legacy-session";

    if (sessionId !== activeSessionId) {
      previousSessionsDurationMs += activeSessionDurationMs;
      activeSessionDurationMs = 0;
      activeSessionId = sessionId;
    }

    activeSessionDurationMs = Math.max(
      activeSessionDurationMs,
      segment.endedAtMs
    );

    return {
      ...segment,
      sessionId,
      speaker: segment.speaker ?? null,
      text: normalizeText(segment.text),
      timelineStartedAtMs: previousSessionsDurationMs + segment.startedAtMs,
      timelineEndedAtMs: previousSessionsDurationMs + segment.endedAtMs,
    };
  });
}

export function groupTranscriptSegments(
  segments: TranscriptPresentationSegment[]
): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];

  for (const segment of withContinuousTimeline(segments)) {
    if (!segment.text) continue;

    const current = blocks.at(-1);
    const nextTextLength = current
      ? current.text.length + 1 + segment.text.length
      : segment.text.length;
    const canMerge = Boolean(
      current &&
      current.sessionId === segment.sessionId &&
      // 화자가 바뀌면 안 합친다. 합치면 두 사람의 말이 한 사람 것으로 읽힌다 —
      // 시간이 붙어 있을수록 오히려 더 그렇다(말이 겹치는 구간).
      current.speaker === segment.speaker &&
      segment.startedAtMs - current.endedAtMs <= MAX_GAP_MS &&
      segment.endedAtMs - current.startedAtMs <= MAX_BLOCK_DURATION_MS &&
      current.segmentIds.length < MAX_SEGMENTS_PER_BLOCK &&
      nextTextLength <= MAX_BLOCK_TEXT_LENGTH
    );

    if (!current || !canMerge) {
      blocks.push({
        blockId: segment.segmentId,
        sessionId: segment.sessionId,
        speaker: segment.speaker,
        segmentIds: [segment.segmentId],
        text: segment.text,
        startedAtMs: segment.startedAtMs,
        endedAtMs: segment.endedAtMs,
        timelineStartedAtMs: segment.timelineStartedAtMs,
        timelineEndedAtMs: segment.timelineEndedAtMs,
      });
      continue;
    }

    current.segmentIds.push(segment.segmentId);
    current.text = `${current.text} ${segment.text}`;
    current.endedAtMs = segment.endedAtMs;
    current.timelineEndedAtMs = segment.timelineEndedAtMs;
  }

  return blocks;
}
