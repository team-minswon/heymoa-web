import { memo, type CSSProperties, type RefObject } from "react";

import { SpeakerChip } from "@/components/notes/speaker-chip";
import {
  formatOffset,
  type TranscriptPresentationSegment,
} from "@/lib/transcription/presentation";
import type { SpeakerIdentity } from "@/lib/transcription/speaker-identity";

/** 근거 인용이 짚은 줄에만 붙는 것. 다른 줄은 `null` 이라 같은 값으로 비교된다. */
export type TranscriptRowFocus = {
  ref: RefObject<HTMLElement | null> | undefined;
  markProps: { className?: string; style?: CSSProperties };
};

type Props = {
  segment: TranscriptPresentationSegment;
  speaker: SpeakerIdentity | null;
  focus: TranscriptRowFocus | null;
};

/**
 * 같은 줄이면 다시 그리지 않는다. 확정 줄은 불변이라, 새 발화가 붙을 때마다 전체 N줄을 다시
 * 그리면 긴 회의일수록 final·중지·마지막 재조회가 메인 스레드를 길게 잡는다(APP-1246).
 *
 * `segment` 는 참조가 아니라 **그리는 값**으로 가른다 — 실시간 줄이 재조회로 서버의 같은 줄로
 * 바뀌어도 내용이 같으면 그대로 둔다. 화자(`speaker`)는 부모가 라벨마다 한 번만 만들어 참조가 같다.
 */
export function sameTranscriptRow(prev: Props, next: Props) {
  const a = prev.segment;
  const b = next.segment;
  return (
    prev.speaker === next.speaker &&
    prev.focus === next.focus &&
    (a === b ||
      (a.segmentId === b.segmentId &&
        a.startedAtMs === b.startedAtMs &&
        a.text === b.text &&
        (a.speakerLabel ?? null) === (b.speakerLabel ?? null)))
  );
}

export const TranscriptRow = memo(function TranscriptRow({
  segment,
  speaker,
  focus,
}: Props) {
  return (
    <article
      ref={focus?.ref}
      /* 짚힌 줄로 포커스를 옮길 수 있게 늘 단다. 짚힌 줄에만 달면 형광이 꺼질 때
         속성이 사라지며 포커스를 빼앗는다. `-1` 은 Tab 순서에 안 든다. */
      tabIndex={-1}
      data-testid="transcript-block"
      data-timeline-start-ms={segment.startedAtMs}
      data-state="final"
      data-focused={focus ? true : undefined}
      className="group grid grid-cols-1 gap-2 border-b border-[var(--el-hairline)] py-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-5"
    >
      <time className="pt-1 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)] transition-colors group-hover:text-[var(--el-ink)] sm:w-32">
        {formatOffset(segment.startedAtMs)}
      </time>
      <div className="min-w-0">
        {speaker ? <SpeakerChip identity={speaker} className="mb-1" /> : null}
        <p className="whitespace-normal text-read leading-7 tracking-[0.005em] text-[var(--el-ink)]">
          <span {...focus?.markProps}>{segment.text}</span>
        </p>
      </div>
    </article>
  );
}, sameTranscriptRow);
