"use client";

import { Fragment, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";

import type {
  ContextCandidateHead,
  ContextEvidence,
} from "@/lib/notes/context-candidates/contract";
import type { ContextCard } from "@/lib/notes/context-candidates/reducer";
import {
  CONTEXT_KIND_ICON,
  CONTEXT_KIND_LABEL,
  CONTEXT_OPERATION_LABEL,
} from "@/lib/notes/context-candidates/presentation";
import { formatOffset } from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";

/**
 * 사건 카드 하나.
 *
 * **유형은 색이 아니라 회색 단어로 말한다.** design.pen 신판 미학 선언이 그렇게 정한다 —
 * kind 가 일곱이라 색으로 가르면 무채색 편집 화면에 일곱 색이 생긴다. 아이콘도 안 쓴다.
 *
 * **유형으로 항목을 가르지 않는다.** 면도, 굵기도, 색도 쓰지 않는다 — 무엇이 결정이고
 * 무엇이 보고인지는 묶음 머리가 이미 말한다. 항목 안에서 한 번 더 가르면 강조된 묶음만
 * 읽히고 나머지가 통째로 뒤로 물러난다.
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

function statusNote(candidate: ContextCandidateHead) {
  if (candidate.closeReason === "RETRACTED") return "철회됨";
  if (candidate.closeReason === "RESOLVED") return "답변됨";
  if (candidate.kind === "QUESTION") return "답 대기";
  return null;
}

/**
 * 근거가 실린 전사 시각. **「전사」 접두 없이 시각만** 적는다(design.pen 신판 `owfEJ`) —
 * 제목 줄 오른끝에 붙어서 무엇의 시각인지가 자리로 이미 드러난다.
 */
function EvidenceTimes({ evidence }: { evidence: ContextEvidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
      {evidence.map((item) => formatOffset(item.startedAtMs)).join(" · ")}
    </span>
  );
}

/** 메타 줄의 사이점. `·` 하나가 낱말들을 한 문장으로 잇는다(pen `pqBiv`). */
function MetaDot() {
  return (
    <span
      aria-hidden
      className="text-[11px] text-[var(--el-hairline-strong)]"
    >
      ·
    </span>
  );
}

function CandidateBody({
  candidate,
  onEvidenceSelect,
  kindInGroupHeader = false,
}: {
  candidate: ContextCandidateHead;
  onEvidenceSelect: (segmentId: string) => void;
  /** 유형을 묶음 머리가 이미 말했다 — 그 아래 모든 줄에 같은 단어를 반복하지 않는다. */
  kindInGroupHeader?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const evidenceId = `context-evidence-${candidate.candidateId}`;
  const hasEvidence = candidate.evidence.length > 0;
  const retracted = candidate.closeReason === "RETRACTED";
  const note = statusNote(candidate);

  /**
   * 메타 줄에 실제로 설 것들. **왼쪽에 이어 붙인다**(design.pen 신판 `on9gz`) — 시각은
   * 제목 줄 오른끝으로 갔으므로 이 줄은 「무엇이고 무슨 일이 있었나」만 말한다.
   *
   * `CREATE` 는 넣지 않는다. 「새로 포착」은 *아직 아무 일도 안 일어났다*는 뜻이라 할 말이
   * 없고, 원장에서 가장 흔한 상태라 적어 두면 회색 단어가 목록의 절반에 깔린다.
   * **`revision === 1` 로 가르지 않는다** — `RESOLVE` 가 만든 결과 후보는 revision 이
   * 1 인데 operation 은 `RESOLVE` 다.
   */
  const metaParts: React.ReactNode[] = [
    kindInGroupHeader ? null : (
      <span key="kind" className="text-[11.5px] text-[var(--el-muted)]">
        {CONTEXT_KIND_LABEL[candidate.kind]}
      </span>
    ),
    candidate.operation === "CREATE" ? null : (
      <span
        key="operation"
        className={cn(
          "text-[11.5px] text-[var(--el-muted-soft)]",
          candidate.operation === "RETRACT" &&
            "font-medium text-[var(--el-error-strong)]"
        )}
      >
        {CONTEXT_OPERATION_LABEL[candidate.operation]}
      </span>
    ),
    note ? (
      <span key="note" className="text-[11.5px] text-[var(--el-muted-soft)]">
        {note}
      </span>
    ) : null,
    // 사람이 고쳤는지가 아니라 몇 번 바뀌었는지다. v1 에 사람 편집 경로가 없다.
    candidate.aiSemanticRevisionCount > 0 ? (
      <span
        key="revisions"
        className="text-[11.5px] tabular-nums text-[var(--el-muted-soft)]"
      >
        {`수정 ${candidate.aiSemanticRevisionCount}`}
      </span>
    ) : null,
  ].filter(Boolean);

  return (
    // pen `q5GjLZ`: 카드 본문은 세로 gap 7 이다.
    <div className="flex flex-col gap-[7px]">
      <button
        type="button"
        disabled={!hasEvidence}
        aria-expanded={hasEvidence ? open : undefined}
        aria-controls={hasEvidence ? evidenceId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "group/claim -mx-1.5 flex w-full items-start gap-2.5 rounded-block px-1.5 text-left",
          !hasEvidence && "cursor-default"
        )}
      >
        <span
          className={cn(
            // pen `uiVRc` 는 14.5 인데 **13.3 으로 둔다** — 440 짜리 레일에서 14.5 는 담당자까지
            // 붙은 제목이 두 줄로 넘어가는 일이 잦다. 굵기·행간·자간은 pen 그대로다.
            //
            // **유형으로 굵기를 가르지 않는다** — 무엇이 결정이고 무엇이 보고인지는
            // 묶음 머리가 말한다.
            "min-w-0 flex-1 break-keep text-[13.3px] leading-[1.45] font-medium tracking-[-0.1px] text-[var(--el-ink)]",
            // 철회는 흐린 **글자색**으로 낮춘다. 불투명도로 낮추면 그 안의 사이점까지
            // 같이 옅어져 읽을 수 없게 된다.
            retracted &&
              "text-[var(--el-muted-soft)] line-through decoration-[var(--el-muted-soft)]"
          )}
        >
          {candidate.content}
        </span>
        {/* pen `OgiRc`: 시각과 여는 표시가 제목 줄 오른끝에 함께 선다. */}
        <span className="flex shrink-0 items-center gap-2 pt-[3px]">
          <EvidenceTimes evidence={candidate.evidence} />
          {hasEvidence ? (
            <>
              <span className="sr-only">{` 근거 ${candidate.evidence.length}개`}</span>
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-3.5 transition-[transform,color]",
                  open
                    ? "rotate-180 text-[var(--el-ink)]"
                    : "text-[var(--el-muted-soft)] group-hover/claim:text-[var(--el-ink)]"
                )}
              />
            </>
          ) : null}
        </span>
      </button>

      {metaParts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {metaParts.map((part, index) => (
            <Fragment key={index}>
              {index > 0 ? <MetaDot /> : null}
              {part}
            </Fragment>
          ))}
        </div>
      ) : null}

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
              className="mt-1 space-y-1.5 border-l-2 border-[var(--el-hairline)] pl-3"
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
                    <span className="min-w-0 break-keep text-[12px] leading-[1.5] text-[var(--el-muted)]">
                      {evidence.text}
                    </span>
                    <span
                      aria-hidden
                      className="min-w-0 flex-1 translate-y-[-3px] border-b border-dotted border-[var(--el-hairline)]"
                    />
                    <time className="shrink-0 text-[12px] tabular-nums text-[var(--el-muted-soft)] transition-colors group-hover:text-[var(--el-muted)]">
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

/**
 * 사건 하나. 두 벌이 있고 **묶여 있는지가 가른다.**
 *
 * | | 전체 (`list`) | 유형을 좁힘 (`card`) |
 * |---|---|---|
 * | 경계 | 없음 — 묶음 머리가 이미 갈라 놓았다(design.pen 신판 `ywpDW`) | `1px` 테두리 |
 * | 왼쪽 | 15 칸의 불릿(`jWhd6`) | 없음 |
 * | 유형 | 묶음 머리 | 메타 줄 첫 단어 |
 *
 * 묶음 안에서 항목마다 상자를 두르면 경계가 두 겹이 되고, 묶음이 없는 화면에서는 그 상자가
 * 유일한 경계다.
 */
/**
 * 사건 하나. design.pen 신판 「실시간 정리 리디자인」(`O8CpER`)의 행 카드다.
 *
 * 왼쪽 26 배지가 유형을 아이콘으로 말하고 — 묶음 머리와 **같은 아이콘**이라 카드 하나만
 * 봐도 어느 묶음의 것인지 안다 — 오른쪽 본문이 제목·시각·메타를 진다.
 */
export function ContextCandidateCard({
  card,
  onEvidenceSelect,
  kindInGroupHeader,
}: {
  card: ContextCard;
  onEvidenceSelect: (segmentId: string) => void;
  /** 유형을 묶음 머리가 이미 말했다 — 그 아래 모든 줄에 같은 단어를 반복하지 않는다. */
  kindInGroupHeader: boolean;
}) {
  const reduced = useReducedMotion();
  const KindIcon = CONTEXT_KIND_ICON[card.kind];

  return (
    <motion.li
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
      className="flex gap-[11px] rounded-[12px] border border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-3.5 py-[13px] shadow-[0_1px_2px_#00000010]"
    >
      <span
        aria-hidden
        className="flex size-[26px] shrink-0 items-center justify-center rounded-[8px] border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]"
      >
        <KindIcon className="size-3.5 text-[var(--el-body)]" />
      </span>
      <div className="min-w-0 flex-1">
        <CandidateBody
          candidate={card}
          onEvidenceSelect={onEvidenceSelect}
          kindInGroupHeader={kindInGroupHeader}
        />
        {/* 답은 질문에 딸린다 — 세로선이 그 딸림을 말한다. */}
        {card.results.length > 0 ? (
          <ul className="mt-2 space-y-2 border-l-2 border-[var(--el-hairline)] pl-3">
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
      </div>
    </motion.li>
  );
}
