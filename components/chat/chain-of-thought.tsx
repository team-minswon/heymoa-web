"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  ChevronRight,
  ExternalLink,
  FileText,
  Folder,
  Loader2,
  X,
} from "lucide-react";

import type { Block, ApprovalDecision } from "@/lib/chat/blocks";
import { cn } from "@/lib/utils";

/**
 * 연속된 생각·도구·승인을 접이식 묶음 하나로 그린다. AI Elements·assistant-ui 는 AI SDK 의
 * `UIMessage` 에 묶여 있어 직접 만든다. 문구는 ai 가 아니라 여기서 블록을 보고 만든다.
 */

// `note-summary` 의 근거 목록과 같은 값이다. 같은 화면에서 다른 속도로 열리면 따로 논다.
const COLLAPSE_TRANSITION = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.22,
};

export type StepBlock = Exclude<Block, { kind: "text" }>;

/** 과정은 카드가 아니라 답변 옆 여백 메모라 세로선 한 줄로 가른다. */
const RAIL = "border-l border-[var(--el-hairline-strong)] pl-3.5";

/**
 * 그려지는 단계만 센다. 확정 전 승인은 카드가 따로 서서 여기 안 그리는데, 그걸 세면
 * 헤더 개수가 틀어지고 그 블록 하나뿐일 때 빈 레일이 한 칸 선다.
 */
function drawable(blocks: StepBlock[]) {
  return blocks.filter((block) => !isPendingApproval(block));
}

/**
 * 확정 전 승인. `StepRow` 가 안 그리는 조건과 같은 술어여야 한다 — 어긋나면 필터는
 * 통과시키고 렌더러는 null 을 내어 빈 레일이 돌아온다.
 */
function isPendingApproval(block: StepBlock) {
  return block.kind === "approval" && !block.decision;
}

export function ChainOfThought({
  blocks,
  live,
  onOpenNote,
}: {
  blocks: StepBlock[];
  /** 이 묶음이 아직 흐르는 중인가. 스트리밍 중에는 펼치고 끝나면 접는다. */
  live: boolean;
  onOpenNote?: (noteId: string) => void;
}) {
  const drawn = drawable(blocks);
  if (drawn.length === 0) return null;

  // 확정 전 승인은 도는 중이 아니라 사람을 기다리는 중이다. 그걸 걸러 냈다면 그려지는
  // 단계는 다 끝났으므로 `running` 을 내린다 — 안 그러면 바로 앞 단계가 승인 때까지 돈다.
  const running = live && drawn.length === blocks.length;

  // 하나여도 서랍으로 그린다. 개수로 모양을 가르면 둘째 단계가 오는 순간 다시 마운트되며 튄다.
  return (
    <Disclosure
      blocks={drawn}
      live={live}
      running={running}
      onOpenNote={onOpenNote}
    />
  );
}

function Disclosure({
  blocks,
  live,
  running,
  onOpenNote,
}: {
  blocks: StepBlock[];
  /** 이 턴이 아직 안 끝났나. 서랍 여닫기는 이 값을 따른다. */
  live: boolean;
  /**
   * 지금 도는 단계가 있나. 스피너는 이 값을 따른다. 승인을 기다리는 동안은 `live` 인데
   * 도는 것은 없다.
   */
  running: boolean;
  onOpenNote?: (noteId: string) => void;
}) {
  // 도는 동안은 펴 두고 끝나면 접는다. 줄이 하나면 접어도 아낄 자리가 없어 편 채로 둔다.
  const roomToSave = blocks.length > 1;
  const [open, setOpen] = useState(live || !roomToSave);
  const reduced = useReducedMotion();
  // 사용자가 손으로 건드렸으면 자동 접힘/펼침이 그걸 덮지 않는다.
  const touched = useRef(false);

  useEffect(() => {
    if (touched.current) return;
    setOpen(live || !roomToSave);
  }, [live, roomToSave]);

  return (
    <div
      data-cot="group"
      data-open={open ? "true" : "false"}
      // 떠오르는 것은 흐를 때 한 번이다. 끝난 묶음은 히스토리로 다시 마운트되는데 거기서 또
      // 떠오르면 레일이 한 번 더 번쩍인다.
      className={cn(live && "chat-rise", RAIL)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          touched.current = true;
          setOpen((value) => !value);
        }}
        // 커서를 여기서 준다. `@layer base` 의 `button { cursor: pointer }` 에 기대면 Tailwind 를
        // 올릴 때 조용히 뒤집힌다.
        className="-ml-1 flex w-full cursor-pointer items-center gap-1.5 py-0.5 text-left"
      >
        <ChevronRight
          aria-hidden
          className={
            open
              ? "size-3.5 shrink-0 rotate-90 text-[var(--el-muted)] transition-transform"
              : "size-3.5 shrink-0 text-[var(--el-muted)] transition-transform"
          }
        />
        {/* 접혀서 도는 동안에만 지금 하는 일을 말한다. 펴져 있으면 바로 아래 줄이 같은
            말을 하므로 되풀이하지 않는다. */}
        <span
          className={cn(
            "min-w-0 truncate text-xs",
            running && !open ? "chat-shimmer" : "text-[var(--el-muted)]"
          )}
        >
          {running && !open ? currentStep(blocks) : headline(blocks)}
        </span>
      </button>
      {/* `initial={false}` 는 흐르는 중 이미 펴진 채로 다시 그려질 때 매 토큰 다시 자라지 않게 한다. */}
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="steps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : COLLAPSE_TRANSITION}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 pt-1.5 pb-0.5">
              {blocks.map((block, index) => (
                <StepRow
                  key={stepKey(block, index)}
                  block={block}
                  live={running && index === blocks.length - 1}
                  animate={live}
                  onOpenNote={onOpenNote}
                />
              ))}
              {/* 도구 결과가 오고 다음 생각·토큰이 오기까지 모델이 도는 사이. 마지막 줄이
                  이미 체크로 굳어 멈춘 것처럼 보이므로 이 줄을 세운다. */}
              {running && betweenSteps(blocks) ? (
                <div className="flex gap-2" data-step="pending">
                  <Dot state="active" />
                  <p className="chat-shimmer min-w-0 flex-1 text-xs leading-relaxed">
                    생각하는 중
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * 지금 도는 줄. 그리는 마지막 줄이 곧 그것이다 — 승인 대기는 이미 걸러졌다(`drawable`).
 */
function currentStep(blocks: StepBlock[]): string {
  const last = blocks.at(-1);
  if (!last) return "생각 과정";
  if (betweenSteps(blocks)) return "생각하는 중";
  if (last.kind === "thinking") return last.text.split("\n")[0] ?? "생각 과정";
  if (last.kind === "approval") return last.summary ?? last.tool;
  return last.summary ?? last.tool;
}

/**
 * 마지막 단계는 끝났는데 다음이 아직 안 왔다. 마지막이 생각이면 그 줄이 아직 도는 중이다.
 */
function betweenSteps(blocks: StepBlock[]): boolean {
  const last = blocks.at(-1);
  if (!last || last.kind === "thinking") return false;
  // 승인된 도구는 승인 블록 앞에 서 있고 결과가 올 때까지 `status: null` 이다. 마지막만 보면
  // 그 실행 중에 「생각하는 중」이 겹친다.
  if (blocks.some((block) => block.kind === "tool" && block.status === null)) {
    return false;
  }
  return true;
}

function stepKey(block: StepBlock, index: number) {
  if (block.kind === "approval") return `approval-${block.approvalId}`;
  if (block.kind === "tool") return `tool-${block.toolCallId}`;
  return `thinking-${index}`;
}

/** 끝난 묶음의 이름. 접힌 채로도 무엇을 봤는지 말한다. */
function headline(blocks: StepBlock[]): string {
  const notes = new Set(
    blocks.flatMap((block) =>
      block.kind === "tool" && block.target?.kind === "note" && block.target.id
        ? [block.target.id]
        : []
    )
  );
  const projects = new Set(
    blocks.flatMap((block) =>
      block.kind === "tool" &&
      block.target?.kind === "project" &&
      block.target.id
        ? [block.target.id]
        : []
    )
  );
  const what = [
    notes.size > 0 ? `회의록 ${notes.size}건` : null,
    projects.size > 0 ? `프로젝트 ${projects.size}개` : null,
  ].filter(Boolean);

  // 단계 수는 안 센다. 접힌 줄은 무엇에 대한 생각이었나만 말한다.
  return what.length > 0 ? `생각 과정 · ${what.join(" · ")}` : "생각 과정";
}

function StepRow({
  block,
  live,
  animate,
  onOpenNote,
}: {
  block: StepBlock;
  live: boolean;
  /** 이 묶음이 흐르는 중이라 새 줄이 떠오르며 선다. 끝난 묶음은 소리 없이 선다. */
  animate: boolean;
  onOpenNote?: (noteId: string) => void;
}) {
  const row = cn(animate && "chat-rise", "flex gap-2");
  if (block.kind === "thinking") {
    return (
      <div className={row} data-step="thinking">
        <Dot state={live ? "active" : "complete"} />
        {/* 생각이 여럿이면 줄바꿈으로 온다. `whitespace-pre-line` 이 없으면 두 문장이
            한 줄로 붙는다. */}
        <p
          className={cn(
            "min-w-0 flex-1 text-xs leading-relaxed whitespace-pre-line",
            live ? "chat-shimmer" : "text-[var(--el-muted)]"
          )}
        >
          {block.text}
        </p>
      </div>
    );
  }

  if (block.kind === "approval") {
    // 확정 전에는 승인 카드가 따로 서 있다 — 여기 기록은 결정이 온 뒤에만 남는다.
    if (!block.decision) return null;
    return (
      <div className={row} data-step="approval">
        <Dot state="complete" />
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--el-muted)]">
          <span className="font-medium text-[var(--el-body-strong)]">
            {block.decision === "APPROVED" ? "승인함" : "거절함"}
          </span>
          {/* 도구 id 로 대신하지 않는다. 카드는 `summary` 로 물었는데 여기서 기계 이름으로
              답하면 같은 일을 두 이름으로 부른다. 계약이 `summary` 를 저장하지 않아
              새로고침 뒤에는 비어 있다. */}
          {block.summary ? ` · ${block.summary}` : null}
          {block.decision === "REJECTED"
            ? " — 도구는 실행되지 않았습니다"
            : null}
        </p>
      </div>
    );
  }

  return (
    <div className={row} data-step="tool">
      <Dot
        state={
          block.status === "error"
            ? "error"
            : block.status === "stopped" || block.status === "unknown"
              ? "pending"
              : block.status
                ? "complete"
                : "active"
        }
      />
      <div className="min-w-0 flex-1">
        {/* 도는 줄은 글자 자신이 빛난다. 끝나면 빛이 멈추고 점이 체크로 바뀐다. */}
        {block.summary || block.tool ? (
          <p
            className={cn(
              "text-xs leading-relaxed",
              block.status === null && live
                ? "chat-shimmer"
                : "text-[var(--el-muted)]"
            )}
          >
            {block.summary ?? block.tool}
          </p>
        ) : null}
        <TargetChip target={block.target} onOpenNote={onOpenNote} />
        {/* 성공은 왼쪽 체크가 말하므로 배지를 안 단다. 실패·중단만 한 줄로 적는다. */}
        {block.status === "error" ? (
          <p className="text-xs text-[var(--el-error)]">실행하지 못했습니다</p>
        ) : null}
        {block.status === "stopped" ? (
          <p className="text-xs text-[var(--el-muted)]">중단됨</p>
        ) : null}
        {block.status === "unknown" ? (
          <p className="text-xs font-medium text-[var(--el-body-strong)]">
            확인 필요
          </p>
        ) : null}
        {block.url ? (
          <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--el-ink)] underline underline-offset-2"
          >
            열어 보기
            <ExternalLink aria-hidden className="size-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * 도구가 향하는 곳. 그릴 줄 아는 `kind` 둘만 칩으로 세우고 모르는 것은 안 그린다.
 */
function TargetChip({
  target,
  onOpenNote,
}: {
  target: Extract<Block, { kind: "tool" }>["target"];
  onOpenNote?: (noteId: string) => void;
}) {
  if (!target || !target.title) return null;
  if (target.kind !== "note" && target.kind !== "project") return null;

  const Icon = target.kind === "note" ? FileText : Folder;
  const label = (
    <>
      <Icon aria-hidden className="size-3 shrink-0" />
      <span className="truncate">{target.title}</span>
    </>
  );
  const shape =
    "mt-1 inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--el-hairline-strong)] px-2 py-0.5 text-[11px] text-[var(--el-body)]";

  if (target.kind === "note" && target.id && onOpenNote) {
    return (
      <button
        type="button"
        data-target="note"
        onClick={() => onOpenNote(target.id as string)}
        className={`${shape} hover:border-[var(--el-ink)]`}
      >
        {label}
      </button>
    );
  }
  return (
    <span data-target={target.kind} className={shape}>
      {label}
    </span>
  );
}

function Dot({
  state,
}: {
  state: "complete" | "active" | "error" | "pending";
}) {
  if (state === "active")
    return (
      <Loader2
        aria-hidden
        className="mt-[3px] size-3 shrink-0 animate-spin text-[var(--el-muted)]"
      />
    );
  if (state === "complete")
    return (
      <Check
        aria-hidden
        className="mt-[3px] size-3 shrink-0 text-[var(--el-muted)]"
      />
    );
  if (state === "error")
    return (
      <X
        aria-hidden
        className="mt-[3px] size-3 shrink-0 text-[var(--el-error)]"
      />
    );
  return (
    <span
      aria-hidden
      className="mt-[6px] size-1.5 shrink-0 rounded-full bg-[var(--el-hairline-strong)]"
    />
  );
}

/**
 * 답변 아래 근거 줄. 문구는 `refs` 의 회의록 수로 web 이 만든다. `refs` 는 「본 것」이지
 * 「어느 문장을 뒷받침하는지」가 아니라서 번호 각주로 그리지 않는다.
 *
 * 1건이면 펴 두고 여럿이면 접어 둔다. 하나뿐이면 접어도 아낄 자리가 없고, 그 칩이
 * 회의록으로 가는 유일한 문이다.
 *
 * `<details>` 는 여는 움직임을 못 만들어서 `Disclosure` 와 같은 버튼 + state 로 쓴다.
 */
export function AnswerRefs({
  refs,
  animate = false,
  onOpenNote,
}: {
  refs: { id: string; title: string }[];
  /** 방금 흐르다 끝난 답의 근거 줄이라 떠오르며 선다. 히스토리 행은 소리 없이 선다. */
  animate?: boolean;
  onOpenNote?: (noteId: string) => void;
}) {
  const [open, setOpen] = useState(refs.length === 1);
  const reduced = useReducedMotion();
  if (refs.length === 0) return null;

  return (
    <div
      data-refs="answer"
      data-open={open ? "true" : "false"}
      className={cn(
        animate && "chat-rise",
        "mt-2 border-t border-[var(--el-hairline)] pt-2"
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="-ml-1 flex w-full cursor-pointer items-center gap-1.5 py-0.5 text-left"
      >
        <ChevronRight
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-[var(--el-muted)] transition-transform",
            open && "rotate-90"
          )}
        />
        {/* 「출처」가 아니다. 계약이 싣는 것은 인용한 것이 아니라 본 것이다. */}
        <span className="text-xs text-[var(--el-muted)]">
          참고한 회의록 {refs.length}개
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="refs"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : COLLAPSE_TRANSITION}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {refs.map((ref) => (
                <button
                  key={ref.id}
                  type="button"
                  onClick={() => onOpenNote?.(ref.id)}
                  disabled={!onOpenNote}
                  className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-full border border-[var(--el-hairline-strong)] px-2 py-0.5 text-[11px] text-[var(--el-body)] transition-colors disabled:cursor-default disabled:opacity-60 enabled:hover:border-[var(--el-ink)]"
                >
                  <FileText aria-hidden className="size-3 shrink-0" />
                  <span className="truncate">{ref.title}</span>
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export type { ApprovalDecision };
