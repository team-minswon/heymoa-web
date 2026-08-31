import type { GapRow } from "@/lib/transcription/gaps";

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

/**
 * `groupTranscriptSegments` 를 지웠다 — **세그먼트 하나가 행 하나다.**
 *
 * 묶기는 인접 발화를 네 상수(6세그먼트 · 30초 · 1.5초 · 260자)와 화자 동일 조건으로
 * 한 문단에 이어 붙였다. 지우는 이유가 둘이다.
 *
 * 하나. **실시간 `final` 의 `speakerLabel` 은 항상 `null` 이다** — 화자는 회의가 끝난 뒤에
 * 채워진다. 그래서 녹음 중에는 화자 조건이 없는 것과 같아 숫자 넷만으로 최대 6개가 묶였고,
 * 종료 후 화자가 도착하면 같은 세그먼트가 **다시** 화자 기준으로 쪼개졌다. 읽던 문단 구조가
 * 회의가 끝나는 순간 한 번 흔들렸다.
 *
 * 둘. 묶인 문단은 가운데 세그먼트를 가리키는 DOM 노드가 없어서, 요약의 근거 인용이 문단
 * 전체를 짚을 수밖에 없었다. 1:1이면 짚는 자리가 곧 그 발화다.
 *
 * 좌표는 예전에도 지금도 안 건드린다. 서버가 준 `startedAtMs` 를 그대로 쓴다.
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
