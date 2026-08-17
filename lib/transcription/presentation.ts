import type { GapRow } from "@/lib/transcription/gaps";

export type TranscriptPresentationSegment = {
  segmentId: string;
  sequence: number;
  text: string;
  /** 회의 시작 기준. 서버가 계산해서 준다 — 브라우저가 더하지 않는다. */
  startedAtMs: number;
  endedAtMs: number;
  speakerLabel?: string | null;
};

export type TranscriptBlock = {
  blockId: string;
  segmentIds: string[];
  text: string;
  startedAtMs: number;
  endedAtMs: number;
  speakerLabel: string | null;
};

/**
 * `h:mm:ss` — 한 시간을 넘으면 시를 붙인다.
 *
 * 예전에는 `mm:ss` 뿐이라 **90분 회의의 마지막 발화가 `90:00`** 으로 나왔다. 한 시간 넘는
 * 회의가 흔하므로 그대로 두면 계속 틀린다. 한 시간 미만은 `mm:ss` 를 유지한다.
 */
export function formatOffset(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  if (minutes < 60) return `${pad(minutes)}:${pad(seconds % 60)}`;
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
}

const MAX_SEGMENTS_PER_BLOCK = 6;
const MAX_BLOCK_DURATION_MS = 30_000;
const MAX_GAP_MS = 1_500;
const MAX_BLOCK_TEXT_LENGTH = 260;

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

/**
 * 표시용으로 발화를 묶는다. **좌표는 건드리지 않는다** — `withContinuousTimeline` 이
 * 하던 세션 길이 누적은 사라졌다. 브라우저는 중지한 시간도 끊긴 구간의 길이도 모른다.
 */
export function groupTranscriptSegments(
  segments: TranscriptPresentationSegment[]
): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];

  for (const raw of segments) {
    const segment = { ...raw, text: normalizeText(raw.text) };
    if (!segment.text) continue;
    const speakerLabel = segment.speakerLabel ?? null;

    const current = blocks.at(-1);
    const nextTextLength = current
      ? current.text.length + 1 + segment.text.length
      : segment.text.length;
    const canMerge = Boolean(
      current &&
        // 화자가 다르면 가른다. 한 덩어리에 두 사람의 말이 섞이면 라벨이 거짓이 된다.
        current.speakerLabel === speakerLabel &&
        segment.startedAtMs - current.endedAtMs <= MAX_GAP_MS &&
        segment.endedAtMs - current.startedAtMs <= MAX_BLOCK_DURATION_MS &&
        current.segmentIds.length < MAX_SEGMENTS_PER_BLOCK &&
        nextTextLength <= MAX_BLOCK_TEXT_LENGTH
    );

    if (!current || !canMerge) {
      blocks.push({
        blockId: segment.segmentId,
        segmentIds: [segment.segmentId],
        text: segment.text,
        startedAtMs: segment.startedAtMs,
        endedAtMs: segment.endedAtMs,
        speakerLabel,
      });
      continue;
    }

    current.segmentIds.push(segment.segmentId);
    current.text = `${current.text} ${segment.text}`;
    current.endedAtMs = segment.endedAtMs;
  }

  return blocks;
}

export type TranscriptRow =
  | { type: "block"; startedAtMs: number; block: TranscriptBlock }
  | { type: "gap"; startedAtMs: number; gap: GapRow };

/** 발화와 공백을 회의 축 순서로 한 줄에 세운다. 같은 좌표면 공백이 먼저다. */
export function interleaveTranscript(
  blocks: TranscriptBlock[],
  gaps: GapRow[]
): TranscriptRow[] {
  const rows: TranscriptRow[] = [
    ...gaps.map(
      (gap) => ({ type: "gap", startedAtMs: gap.startedAtMs, gap }) as const
    ),
    ...blocks.map(
      (block) =>
        ({ type: "block", startedAtMs: block.startedAtMs, block }) as const
    ),
  ];
  return rows.sort(
    (a, b) =>
      a.startedAtMs - b.startedAtMs ||
      (a.type === "gap" ? -1 : 0) - (b.type === "gap" ? -1 : 0)
  );
}

export type DiarizationSpeaker = {
  label: string;
  assignedName?: string | null;
};

/**
 * 라벨이 아니라 **연결된 이름**을 보인다.
 *
 * 연결 안 된 화자는 `화자 A` 로 남는다 — 「참석자 아님」으로 확정한 경우도 같다.
 * 그 사람이 누구인지 우리가 모른다는 것이 사실이고, 다른 말로 꾸미면 거짓이 된다.
 */
export function createSpeakerNameResolver(speakers: DiarizationSpeaker[]) {
  const names = new Map(
    speakers
      .filter((speaker) => speaker.assignedName)
      .map((speaker) => [speaker.label, speaker.assignedName!])
  );
  return (label: string | null | undefined) => {
    if (!label) return null;
    return names.get(label) ?? `화자 ${label}`;
  };
}
