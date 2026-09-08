"use client";

import type { ReviewCitation } from "@/lib/notes/meeting-review/contract";
import { formatOffset } from "@/lib/transcription/presentation";

/**
 * 근거 인용 목록. `proposal-card.tsx` 의 펼침 목록과 같은 줄 모양이다 — 인용 본문, 점선,
 * 시각. **`segmentId` 로만 이동한다**(APP-398 선례). 화자는 이름이 연결됐으면 이름, 아니면
 * 라벨을 앞에 둔다. 인용이 없으면 「근거 없음」을 숨기지 않고 적는다.
 */
export function CitationList({
  citations,
  onEvidenceSelect,
  emptyLabel = "근거 없음",
}: {
  citations: ReviewCitation[];
  onEvidenceSelect: (segmentId: string) => void;
  emptyLabel?: string;
}) {
  if (citations.length === 0) {
    return (
      <p className="text-[12px] leading-[1.5] text-[var(--el-muted-soft)]">{emptyLabel}</p>
    );
  }
  return (
    <ul className="space-y-1.5 border-l-2 border-[var(--el-hairline)] pl-3">
      {citations.map((citation) => (
        <li key={`${citation.segmentId}-${citation.role}`}>
          <button
            type="button"
            onClick={() => onEvidenceSelect(citation.segmentId)}
            className="group -mx-1.5 flex w-full items-baseline gap-2 rounded-block px-1.5 py-0.5 text-left transition-colors hover:bg-[var(--el-canvas-soft)]"
          >
            <span className="shrink-0 text-[12px] text-[var(--el-muted-soft)]">
              {speakerOf(citation)}
            </span>
            <span className="min-w-0 break-keep text-[12px] leading-[1.5] text-[var(--el-muted)]">
              {citation.text}
            </span>
            <span
              aria-hidden
              className="min-w-0 flex-1 translate-y-[-3px] border-b border-dotted border-[var(--el-hairline)]"
            />
            <time className="shrink-0 text-[12px] tabular-nums text-[var(--el-muted-soft)] transition-colors group-hover:text-[var(--el-muted)]">
              {formatOffset(citation.startedAtMs)}
            </time>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** 이름이 없으면 라벨. 라벨도 없으면 「화자 미확인」 — 사람을 단정하지 않는다. */
export function speakerOf(citation: ReviewCitation) {
  return citation.speakerName ?? citation.speakerLabel ?? "화자 미확인";
}
