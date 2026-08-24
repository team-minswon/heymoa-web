"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";

import type {
  ContextCandidateHead,
  ContextEvidence,
} from "@/lib/notes/context-candidates/contract";
import type { ContextCard } from "@/lib/notes/context-candidates/reducer";
import { formatOffset } from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";

/**
 * 사건 카드 하나.
 *
 * **유형은 색이 아니라 회색 단어로 말한다.** design.pen 신판 미학 선언이 그렇게 정한다 —
 * kind 가 일곱이라 색으로 가르면 무채색 편집 화면에 일곱 색이 생긴다. 아이콘도 안 쓴다.
 *
 * **강조는 결정 하나뿐이다.** 「한 화면에 이야기 하나, 강조 하나」. 읽는 사람이 찾는 것은
 * 결정과 할 일이고 나머지는 그 주변이다.
 *
 * **닫힌 것을 목록에서 지우지 않는다.** 그리고 `CLOSED` 의 두 뜻을 갈라 그린다 — 철회는
 * 취소이고 해결은 성취다. 둘을 같은 흐림으로 그리면 답이 나온 질문이 취소된 것처럼 보인다.
 */

/** 근거 펼침 움직임. `note-summary.tsx` 와 같은 값이다 — 같은 면의 것들이 같은 속도로 움직인다. */
const EVIDENCE_TRANSITION = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.2,
};

const KIND_LABEL: Record<ContextCandidateHead["kind"], string> = {
  AGENDA: "안건",
  DECISION: "결정",
  ACTION_ITEM: "할 일",
  ISSUE: "이슈",
  QUESTION: "질의응답",
  STATUS_REPORT: "보고",
  INSIGHT: "인사이트",
};

function statusNote(candidate: ContextCandidateHead) {
  if (candidate.closeReason === "RETRACTED") return "철회됨";
  if (candidate.closeReason === "RESOLVED") return "답변됨";
  if (candidate.kind === "QUESTION") return "답 대기";
  return null;
}

function EvidenceTimes({ evidence }: { evidence: ContextEvidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
      {`전사 ${evidence.map((item) => formatOffset(item.startedAtMs)).join(" · ")}`}
    </span>
  );
}

function CandidateBody({
  candidate,
  onEvidenceSelect,
}: {
  candidate: ContextCandidateHead;
  onEvidenceSelect: (segmentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const evidenceId = `context-evidence-${candidate.candidateId}`;
  const hasEvidence = candidate.evidence.length > 0;
  const retracted = candidate.closeReason === "RETRACTED";
  const emphasised = candidate.kind === "DECISION" && !retracted;
  const note = statusNote(candidate);

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        emphasised &&
          "gap-2 rounded-block bg-[var(--el-canvas-soft)] p-3.5",
        // 철회는 흐리게. **해결은 흐리지 않다** — 성취를 취소처럼 보이게 하면 안 된다.
        retracted && "opacity-55"
      )}
    >
      <button
        type="button"
        disabled={!hasEvidence}
        aria-expanded={hasEvidence ? open : undefined}
        aria-controls={hasEvidence ? evidenceId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "group/claim -mx-1.5 rounded-block px-1.5 py-0.5 text-left transition-colors",
          hasEvidence && "hover:bg-[var(--el-surface-strong)]",
          !hasEvidence && "cursor-default"
        )}
      >
        <span
          className={cn(
            "break-keep text-[13px] leading-6 text-[var(--el-ink)]",
            emphasised && "font-semibold",
            retracted && "line-through decoration-[var(--el-muted-soft)]"
          )}
        >
          {candidate.content}
        </span>
        {hasEvidence ? (
          <>
            <span className="sr-only">{` 근거 ${candidate.evidence.length}개`}</span>
            <span
              aria-hidden
              className={cn(
                "ml-1.5 inline-flex translate-y-[-1px] items-center rounded-chip align-baseline transition-colors",
                open
                  ? "text-[var(--el-ink)]"
                  : "text-[var(--el-muted-soft)] group-hover/claim:text-[var(--el-ink)]"
              )}
            >
              <ChevronDown
                className={cn("size-3 transition-transform", open && "rotate-180")}
              />
            </span>
          </>
        ) : null}
      </button>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[12px] text-[var(--el-muted)]">
          {KIND_LABEL[candidate.kind]}
        </span>
        {note ? (
          <span className="text-[12px] text-[var(--el-muted-soft)]">{note}</span>
        ) : null}
        {/* 사람이 고쳤는지가 아니라 몇 번 바뀌었는지다. v1 에 사람 편집 경로가 없다. */}
        {candidate.aiSemanticRevisionCount > 0 ? (
          <span className="font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
            {`수정 ${candidate.aiSemanticRevisionCount}`}
          </span>
        ) : null}
        <span className="min-w-0 flex-1" />
        <EvidenceTimes evidence={candidate.evidence} />
      </div>

      {/* 펼침은 높이가 자라는 일이다 — 그냥 마운트하면 아래 카드들이 한 프레임에 밀린다. */}
      <AnimatePresence initial={false}>
        {open && hasEvidence ? (
          <motion.div
            key="evidence"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : EVIDENCE_TRANSITION}
            className="overflow-hidden"
          >
            <ul
              id={evidenceId}
              className="mt-1 space-y-1.5 border-l border-[var(--el-hairline-strong)] pl-3"
            >
              {candidate.evidence.map((evidence) => (
                <li key={`${evidence.segmentId}-${evidence.role}`}>
                  {/* **`segmentId` 로만 찾는다** — `startedAtMs` 는 세션별 오프셋이라 세션이
                      둘 이상이면 화면의 시각과 어긋난다(APP-398 선례). */}
                  <button
                    type="button"
                    onClick={() => onEvidenceSelect(evidence.segmentId)}
                    className="group -mx-1.5 flex w-full items-baseline gap-2 rounded-block px-1.5 py-0.5 text-left transition-colors hover:bg-[var(--el-canvas-soft)]"
                  >
                    <span className="min-w-0 break-keep text-[12px] leading-5 text-[var(--el-body)]">
                      {evidence.text}
                    </span>
                    <span
                      aria-hidden
                      className="min-w-0 flex-1 translate-y-[-3px] border-b border-dotted border-[var(--el-hairline)]"
                    />
                    <time className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)] transition-colors group-hover:text-[var(--el-muted)]">
                      {formatOffset(evidence.startedAtMs)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function ContextCandidateCard({
  card,
  onEvidenceSelect,
}: {
  card: ContextCard;
  onEvidenceSelect: (segmentId: string) => void;
}) {
  return (
    <li className="flex flex-col gap-2">
      <CandidateBody candidate={card} onEvidenceSelect={onEvidenceSelect} />
      {/* `RESOLVE` 는 질문 하나가 답 여럿으로 바뀐 **한 사건**이다. 결과를 최상위에 흩으면
          그 관계가 사라진다. */}
      {card.results.length > 0 ? (
        <ul className="ml-1 space-y-2 border-l border-[var(--el-hairline)] pl-3">
          {card.results.map((result) => (
            <li key={result.candidateId}>
              <CandidateBody
                candidate={result}
                onEvidenceSelect={onEvidenceSelect}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
