"use client";

import type { ReviewEvaluation } from "@/lib/notes/meeting-review/contract";

import { CitationList } from "./citation-list";
import { RegionFrame, StatusChip } from "./region-frame";

/**
 * 「회의 평가」 영역. **AI 의 해석이다** — 배지로 못박고 합의된 명제나 개인 평가처럼 보이지
 * 않게 한다. 편집은 없고 관련 항목·전사로 이동만 한다. 실패·오래됨은 다른 영역을 막지
 * 않는다(승인 가능 여부는 server 게이트가 따로 말한다).
 */
export function EvaluationPanel({
  evaluation,
  onEvidenceSelect,
  onSelectItem,
}: {
  evaluation: ReviewEvaluation;
  onEvidenceSelect: (segmentId: string) => void;
  onSelectItem: (itemId: string) => void;
}) {
  return (
    <RegionFrame
      title="회의 평가"
      status={evaluation.status}
      waitingLabel="AI 가 회의를 평가하고 있습니다. 명제 검토는 기다리지 않아도 됩니다."
      emptyLabel="이 회의에는 평가가 없습니다."
      failedLabel={
        evaluation.error
          ? `평가를 만들지 못했습니다 · ${evaluation.error}. 명제 검토와 승인은 계속할 수 있습니다.`
          : "평가를 만들지 못했습니다. 명제 검토와 승인은 계속할 수 있습니다."
      }
      aside={<StatusChip tone="ai">AI 해석</StatusChip>}
      testId="review-evaluation"
    >
      <div className="space-y-4">
        {evaluation.sections.map((section) => (
          <article key={section.title} className="space-y-1.5">
            <h4 className="text-[13px] font-medium text-[var(--el-ink)]">{section.title}</h4>
            <p className="text-[14px] leading-[1.6] text-[var(--el-body)]">{section.body}</p>
            {section.itemRefs.length > 0 ? (
              <p className="flex flex-wrap gap-1.5 text-[12px]">
                {section.itemRefs.map((ref) => (
                  <button
                    key={`${ref.type}:${ref.itemId}`}
                    type="button"
                    onClick={() => ref.type === "REVIEW" && onSelectItem(ref.itemId)}
                    className="rounded-[6px] border border-[var(--el-hairline)] px-1.5 py-0.5 text-[var(--el-muted)] hover:text-[var(--el-ink)]"
                  >
                    관련 항목
                  </button>
                ))}
              </p>
            ) : null}
            <CitationList citations={section.citations} onEvidenceSelect={onEvidenceSelect} />
          </article>
        ))}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px] text-[var(--el-muted)]">
          {evaluation.limitations ? (
            <>
              <dt>한계</dt>
              <dd className="text-[var(--el-body)]">{evaluation.limitations}</dd>
            </>
          ) : null}
          <dt>생성 버전</dt>
          <dd className="tabular-nums">
            {evaluation.resultVersion ?? "—"}
            {evaluation.stale ? " · 원본이 바뀐 뒤의 평가가 아닙니다" : ""}
          </dd>
        </dl>
      </div>
    </RegionFrame>
  );
}
