import Link from "next/link";
import { LoaderCircle } from "lucide-react";

import { SectionBlock } from "@/components/notes/review/section-block";
import { InlineRetry } from "@/components/ui/inline-retry";
import type {
  MeetingAnalysisFlowResponseDataRegionsItemStatus,
  TranscriptResponseDataSegmentsItem,
} from "@/lib/api/generated/models";
import {
  LINK_LABEL,
  type MeetingRelation,
} from "@/lib/notes/review/meeting-links";
import { formatOffset } from "@/lib/transcription/presentation";

/** 관계 판정과 근거만 표시한다. 상태 변경은 기존 제안 카드가 맡는다. */
export function MeetingRelations({
  relations,
  status,
  unavailable,
  loading,
  failed,
  onRetry,
  workspaceId,
  segments,
  onSelectItem,
  onOpenScript,
}: {
  relations: readonly MeetingRelation[];
  status?: MeetingAnalysisFlowResponseDataRegionsItemStatus;
  unavailable: boolean;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  workspaceId?: string;
  segments: readonly TranscriptResponseDataSegmentsItem[];
  onSelectItem: (itemId: string) => void;
  onOpenScript: (segmentId: string) => void;
}) {
  const bySequence = new Map(
    segments.map((segment) => [segment.sequence, segment])
  );
  return (
    <SectionBlock title="충돌·이어짐" count={relations.length || undefined}>
      <div className="space-y-3 text-sm leading-6 text-[var(--el-body)]">
        {status === "PENDING" ? (
          <p
            role="status"
            className="flex items-center gap-2 text-[var(--el-muted)]"
          >
            <LoaderCircle
              aria-hidden
              className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
            />
            충돌과 이어짐을 확인하고 있습니다. 회의 정리는 먼저 읽을 수
            있습니다.
          </p>
        ) : status === "FAILED" ? (
          <p role="alert">
            충돌과 이어짐을 분석하지 못했습니다. 회의 정리와 검토 항목은 그대로
            남아 있습니다.
          </p>
        ) : status === "SKIPPED" ? (
          <p>화자 정보를 확인하지 못해 충돌과 이어짐을 분석하지 않았습니다.</p>
        ) : null}
        {unavailable ? (
          <p className="text-[var(--el-muted)]">
            프로젝트에 연결하면 회의의 충돌과 이어짐을 확인할 수 있습니다.
          </p>
        ) : failed ? (
          <InlineRetry
            variant="line"
            label="회의 연결을 불러오지 못했습니다."
            onRetry={onRetry}
          />
        ) : loading ? (
          <p role="status" className="text-[var(--el-muted)]">
            충돌과 이어짐을 불러오고 있습니다.
          </p>
        ) : relations.length === 0 && !status ? (
          <p className="text-[var(--el-muted)]">이 회의의 관계 분석 상태를 확인할 수 없습니다.</p>
        ) : relations.length === 0 && status === "SUCCEEDED" ? (
          <p className="text-[var(--el-muted)]">
            확인된 충돌과 이어짐이 없습니다.
          </p>
        ) : null}
        {relations.length > 0 ? (
          <ul
            aria-label="충돌과 이어짐"
            className="divide-y divide-[var(--el-hairline-soft)] border-y border-[var(--el-hairline-soft)]"
          >
            {relations.map((relation) => {
              const quotes = relation.evidenceSequences.flatMap((sequence) => {
                const segment =
                  typeof sequence === "number"
                    ? bySequence.get(sequence)
                    : undefined;
                return segment ? [segment] : [];
              });
              return (
                <li key={relation.key} className="space-y-1.5 py-3">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-[var(--el-muted)]">
                    <strong className="font-semibold text-[var(--el-ink)]">
                      {LINK_LABEL[relation.kind]}
                    </strong>
                    <span>
                      {relation.scope === "same"
                        ? "같은 회의"
                        : relation.scope === "approved"
                          ? "프로젝트 확정 항목"
                          : "이전 회의"}
                    </span>
                    <span>판 {relation.target.revision}</span>
                  </p>
                  <p className="break-words text-[var(--el-ink)]">
                    {relation.sourceItemId ? (
                      <button
                        type="button"
                        aria-label={`관계 출발 항목 보기 · ${relation.source.content}`}
                        className="text-left underline decoration-[var(--el-hairline-strong)] underline-offset-4"
                        onClick={() => onSelectItem(relation.sourceItemId!)}
                      >
                        {relation.source.content}
                      </button>
                    ) : (
                      relation.source.content
                    )}
                  </p>
                  <p className="break-words">
                    <span aria-hidden>→ </span>
                    {relation.targetItemId ? (
                      <button
                        type="button"
                        aria-label={`관계 대상 항목 보기 · ${relation.target.content}`}
                        className="text-left underline decoration-[var(--el-hairline-strong)] underline-offset-4"
                        onClick={() => onSelectItem(relation.targetItemId!)}
                      >
                        {relation.target.content}
                      </button>
                    ) : (
                      relation.target.content
                    )}
                  </p>
                  {relation.scope === "past" &&
                  workspaceId &&
                  relation.target.noteId ? (
                    <Link
                      className="text-xs underline underline-offset-4"
                      href={`/w/${workspaceId}/notes/${relation.target.noteId}?view=full&tab=summary`}
                    >
                      {relation.targetTitle}
                    </Link>
                  ) : null}
                  {relation.reason ? (
                    <p className="whitespace-pre-wrap break-words text-[var(--el-muted)]">
                      {relation.reason}
                    </p>
                  ) : null}
                  {quotes.length > 0 ? (
                    <ul
                      aria-label="관계 근거 발언"
                      className="space-y-1 border-l border-[var(--el-hairline)] pl-3 text-xs text-[var(--el-muted)]"
                    >
                      {quotes.map((segment) => (
                        <li key={segment.segmentId}>
                          <button
                            type="button"
                            className="text-left leading-5 hover:text-[var(--el-ink)]"
                            onClick={() => onOpenScript(segment.segmentId)}
                          >
                            {formatOffset(segment.startedAtMs)} · {segment.text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </SectionBlock>
  );
}
