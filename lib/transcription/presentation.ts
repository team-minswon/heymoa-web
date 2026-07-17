export type TranscriptPresentationSegment = {
  segmentId: string;
  transcriptionSessionId?: string;
  sequence: number;
  text: string;
  startedAtMs: number;
  endedAtMs: number;
};

export type TranscriptBlock = {
  blockId: string;
  sessionId: string;
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
      segment.startedAtMs - current.endedAtMs <= MAX_GAP_MS &&
      segment.endedAtMs - current.startedAtMs <= MAX_BLOCK_DURATION_MS &&
      current.segmentIds.length < MAX_SEGMENTS_PER_BLOCK &&
      nextTextLength <= MAX_BLOCK_TEXT_LENGTH
    );

    if (!current || !canMerge) {
      blocks.push({
        blockId: segment.segmentId,
        sessionId: segment.sessionId,
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
