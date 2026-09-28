import type { GapRow } from "@/lib/transcription/gaps";
import type { RecordingPhase } from "@/lib/transcription/recording-state";
import type { LivePartial } from "@/lib/transcription/transcript-reducer";

export type TranscriptPresentationSegment = {
  segmentId: string;
  sequence: number;
  text: string;
  /** 회의 시작 기준. 서버가 계산해서 준다 — 브라우저가 더하지 않는다. */
  startedAtMs: number;
  endedAtMs: number;
  speakerLabel?: string | null;
  /**
   * 이 발화에만 사람이 붙인 참여 기록. `null`/없음이면 [speakerLabel]의 지정을 따른다.
   *
   * 실시간 전사(`TranscriptView`)에는 없는 값이다 — 회의가 끝나고 화자가 나뉜 뒤라야
   * 붙일 수 있어서 선택 필드로 둔다.
   */
  assignedParticipantId?: string | null;
};

/** 한 시간 미만은 `mm:ss`, 넘으면 `h:mm:ss`. */
export function formatOffset(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  if (minutes < 60) return `${pad(minutes)}:${pad(seconds % 60)}`;
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
}

/**
 * 세그먼트 하나가 행 하나다. 묶지 않는다 — 실시간 `final` 의 `speakerLabel` 은 회의가 끝난 뒤에야
 * 채워져서, 묶으면 종료 순간 문단이 화자 기준으로 다시 쪼개진다. 요약의 근거 인용도 1:1 이어야
 * 그 발화를 짚는다. 좌표는 서버가 준 `startedAtMs` 를 그대로 쓴다.
 */
export type TranscriptRow =
  | {
      type: "segment";
      startedAtMs: number;
      segment: TranscriptPresentationSegment;
    }
  | { type: "gap"; startedAtMs: number; gap: GapRow };

/** 발화와 공백을 회의 축 순서로 한 줄에 세운다. 같은 좌표면 공백이 먼저다. */
export function interleaveTranscript(
  segments: TranscriptPresentationSegment[],
  gaps: GapRow[]
): TranscriptRow[] {
  const rows: TranscriptRow[] = [
    ...gaps.map(
      (gap) => ({ type: "gap", startedAtMs: gap.startedAtMs, gap }) as const
    ),
    // 빈 발화는 서버가 안 보내지만, 오면 빈 행이 되므로 여기서 떨군다.
    ...segments
      .filter((segment) => segment.text.trim())
      .map(
        (segment) =>
          ({
            type: "segment",
            startedAtMs: segment.startedAtMs,
            segment,
          }) as const
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
 * 저장본이 정본이다. 실시간 사본은 저장본에 아직 없는 발화만 뒤에 메운다. 뒤에 붙어야 따라가기
 * 스크롤이 보는 마지막 줄이 새 발화가 된다. 순서는 `interleaveTranscript` 가 회의 축으로 세운다.
 */
export function mergeLiveSegments(
  persisted: readonly TranscriptPresentationSegment[],
  ...liveSources: readonly (readonly TranscriptPresentationSegment[])[]
): TranscriptPresentationSegment[] {
  const rows = new Map<string, TranscriptPresentationSegment>();
  persisted.forEach((segment) => rows.set(segment.segmentId, segment));
  for (const source of liveSources) {
    for (const segment of source) {
      if (!rows.has(segment.segmentId)) rows.set(segment.segmentId, segment);
    }
  }
  return [...rows.values()];
}

type LiveTranscriptSource = {
  partial: LivePartial | null;
  finalSegments: readonly { utteranceId: string }[];
};

/**
 * 화면에 그릴 partial 하나. 살아 있는 partial 은 세션당 하나라 이어 붙이지 않는다.
 *
 * 소스 둘은 같은 서버 이벤트에서 갈라진다. 이 탭이 이 노트를 녹음 중(`stopping` 포함 — 멈춘 뒤에도
 * 같은 소켓이 마지막 final 을 흘린다)일 때만 녹음 소켓이 원본이고 노트 토픽은 그 메아리다.
 * `recordingHere` 만으로 가르면 안 된다 — 녹음이 끝나도 `activeNoteId` 는 disconnect 전까지 남아서,
 * 다른 탭·기기가 회의를 재개했을 때 비어 있는 이 탭의 소켓이 토픽을 가린다.
 *
 * utteranceId 대소로 최신을 고르지 않는다. 서버가 재연결 때 이전 id 를 되살린다.
 */
export function selectLivePartial({
  recordingHere,
  phase,
  own,
  topic,
}: {
  /** 이 탭이 이 노트를 녹음하고 있거나 막 녹음했다. */
  recordingHere: boolean;
  phase: RecordingPhase;
  own: LiveTranscriptSource;
  topic: LiveTranscriptSource;
}): { confirmedText: string; pendingText: string } | null {
  const ownSocketIsSource =
    recordingHere && (phase === "recording" || phase === "stopping");
  const live = ownSocketIsSource ? own.partial : topic.partial;
  if (!live) return null;
  const settledIn = (source: LiveTranscriptSource) =>
    source.finalSegments.some(
      (segment) => segment.utteranceId === live.utteranceId
    );
  if (settledIn(topic) || (recordingHere && settledIn(own))) return null;

  // 앞쪽 공백만 턴다. 두 토막 사이의 공백은 어절 경계라 지우면 단어가 붙는다.
  const confirmedText = live.confirmedText.trimStart();
  const pendingText = confirmedText
    ? live.pendingText
    : live.pendingText.trimStart();
  if (!confirmedText && !pendingText.trim()) return null;
  return { confirmedText, pendingText };
}
