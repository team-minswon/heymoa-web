"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * 연속된 생각·도구·승인을 접이식 묶음 하나로.
 *
 * **직접 만든다.** AI Elements와 assistant-ui는 AI SDK의 `UIMessage` part에 강결합인데
 * heymoa는 서버 중계형 SSE다. 구조만 참고했다.
 *
 * 문구는 여기서 만든다 — ai는 구조만 내린다. 「3단계 · 회의록 2건 검토」는 계약에 없고
 * 블록을 세서 web이 쓴다.
 */

export type StepBlock = Exclude<Block, { kind: "text" }>;

/**
 * 과정은 **답변 옆의 여백 메모**다. 카드가 아니다.
 *
 * 예전에는 흰 배경에 테두리를 두른 상자였다 — 답변 말풍선과 같은 무게라, 무엇이 결과이고
 * 무엇이 그 결과에 이르는 길인지가 눈으로 안 갈렸다. 세로선 한 줄이면 「이건 곁가지」가
 * 말해진다. 승인 기록이 이미 쓰던 모양이라 둘이 같은 자리에 선다.
 */
const RAIL = "border-l-2 border-[var(--el-hairline)] pl-3";

/**
 * ★ **그려지는 단계만 센다.**
 *
 * 확정 전 승인은 이 줄에 아무것도 안 그린다 — 카드가 따로 서 있어서다(`StepRow`). 그걸
 * 그대로 세면 둘이 틀어진다: 헤더가 화면에 두 줄뿐인데 「3단계」라고 하고, 그 블록
 * 하나뿐이면 **빈 레일이 한 칸 서서** 답변과 승인 카드 사이가 두 칸으로 벌어진다.
 */
function drawable(blocks: StepBlock[]) {
  return blocks.filter((block) => !isPendingApproval(block));
}

/**
 * 확정 전 승인. **`StepRow` 와 같은 술어를 쓴다** — 여기서 걸러 내는 조건과 저기서
 * 안 그리는 조건이 어긋나면, `decision` 이 `undefined` 로 새어 드는 날 필터는
 * 통과시키고 렌더러는 null 을 내어 **이 함수가 없앤 빈 레일 한 칸이 조용히 돌아온다.**
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

  /**
   * ★ **승인을 기다리는 동안은 도는 것이 없다.**
   *
   * `live` 는 「마지막 단계가 아직 도는 중」이라는 뜻이고, 스피너와 헤더가 그걸 읽는다.
   * 그런데 확정 전 승인을 걸러 내면 그 자리가 **바로 앞 단계로 넘어간다** — 「전사를
   * 훑습니다」가 사람이 승인 버튼을 누를 때까지 무한히 도는 진행 표시가 된다.
   *
   * 확정 전 승인은 **도는 중이 아니라 사람을 기다리는 중**이다. 그것이 걸러졌다면
   * 그려지는 단계는 전부 끝난 것이므로 여기서 `live` 를 내린다. 기다리는 중이라는
   * 말은 승인 카드가 이미 하고 있다.
   */
  const running = live && drawn.length === blocks.length;

  // 단계가 하나뿐이면 묶지 않는다. 접었다 폈다 할 것이 하나인 서랍은 서랍이 아니다.
  if (drawn.length === 1) {
    return (
      <div data-cot="single" className={`chat-rise ${RAIL}`}>
        <StepRow block={drawn[0]} live={running} onOpenNote={onOpenNote} />
      </div>
    );
  }
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
  /** 이 턴이 아직 안 끝났나. **서랍을 여닫는 것은 이 값이다.** */
  live: boolean;
  /**
   * 지금 도는 단계가 있나. **스피너는 이 값이 든다.**
   *
   * 승인을 기다리는 동안 둘이 갈린다 — 턴은 안 끝났지만(서랍은 열린 채로 두어야 무엇을
   * 하려다 물었는지가 보인다) 도는 것은 없다(사람을 기다린다).
   */
  running: boolean;
  onOpenNote?: (noteId: string) => void;
}) {
  const [open, setOpen] = useState(live);
  // 사용자가 손으로 건드렸으면 자동 접힘/펼침이 그걸 덮지 않는다.
  const touched = useRef(false);

  useEffect(() => {
    if (touched.current) return;
    setOpen(live);
  }, [live]);

  return (
    <div
      data-cot="group"
      data-open={open ? "true" : "false"}
      className={`chat-rise ${RAIL}`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          touched.current = true;
          setOpen((value) => !value);
        }}
        className="-ml-1 flex w-full items-center gap-1.5 py-0.5 text-left"
      >
        <ChevronRight
          aria-hidden
          className={
            open
              ? "size-3.5 shrink-0 rotate-90 text-[var(--el-muted)] transition-transform"
              : "size-3.5 shrink-0 text-[var(--el-muted)] transition-transform"
          }
        />
        <span className="text-xs text-[var(--el-muted)]">
          {headline(blocks)}
        </span>
        {running ? (
          <Loader2
            aria-hidden
            className="size-3 shrink-0 animate-spin text-[var(--el-muted)]"
          />
        ) : null}
      </button>
      {open ? (
        <div className="space-y-1.5 pt-1.5 pb-0.5">
          {blocks.map((block, index) => (
            <StepRow
              key={stepKey(block, index)}
              block={block}
              live={running && index === blocks.length - 1}
              onOpenNote={onOpenNote}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function stepKey(block: StepBlock, index: number) {
  if (block.kind === "approval") return `approval-${block.approvalId}`;
  if (block.kind === "tool") return `tool-${block.toolCallId}`;
  return `thinking-${index}`;
}

/**
 * 묶음 헤더. 「3단계 · 회의록 2건 검토」처럼 **무엇을 했는지**까지 말한다 — 단계 수만
 * 세면 접힌 채로는 아무 정보가 없다.
 */
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

  const head = `${blocks.length}단계`;
  return what.length > 0 ? `${head} · ${what.join(" · ")} 검토` : head;
}

function StepRow({
  block,
  live,
  onOpenNote,
}: {
  block: StepBlock;
  live: boolean;
  onOpenNote?: (noteId: string) => void;
}) {
  if (block.kind === "thinking") {
    return (
      <div className="chat-rise flex gap-2" data-step="thinking">
        <Dot state={live ? "active" : "complete"} />
        {/* 생각이 여럿이면 줄바꿈으로 온다 — `whitespace-pre-line`이 없으면 「찾습니다.
            전사에서」처럼 두 문장이 한 줄로 붙어 버린다. */}
        <p className="min-w-0 flex-1 text-xs leading-relaxed whitespace-pre-line text-[var(--el-muted)]">
          {block.text}
        </p>
      </div>
    );
  }

  if (block.kind === "approval") {
    // 확정 전에는 승인 카드가 따로 서 있다 — 여기 기록은 결정이 온 뒤에만 남는다.
    if (!block.decision) return null;
    return (
      <div className="chat-rise flex gap-2" data-step="approval">
        <Dot state="complete" />
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--el-muted)]">
          <span className="font-medium text-[var(--el-body-strong)]">
            {block.decision === "APPROVED" ? "승인함" : "거절함"}
          </span>
          {/* ★ **도구 id 로 안 흘러내린다.** 카드는 `summary`(「Linear 이슈 'APP 버그
              수정' 생성」)로 물었는데 여기서 `linear.create_issue` 로 답하면, 같은 한 번의
              일을 두 화면이 다른 이름으로 부른다. 계약이 `summary` 를 저장하지 않아
              새로고침 뒤에는 사람 말을 되살릴 방법이 없으므로 — **덜 말하되 다른 말을
              하지 않는다.** 무엇을 했는지는 바로 아래 실행 기록이 잇는다. */}
          {block.summary ? ` · ${block.summary}` : null}
          {block.decision === "REJECTED" ? " — 도구는 실행되지 않았습니다" : null}
        </p>
      </div>
    );
  }

  return (
    <div className="chat-rise flex gap-2" data-step="tool">
      <Dot
        state={
          block.status === "error"
            ? "error"
            : block.status
              ? "complete"
              : "active"
        }
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-relaxed text-[var(--el-muted)]">
          {block.summary ?? block.tool}
        </p>
        <TargetChip target={block.target} onOpenNote={onOpenNote} />
        {/* **배지를 안 쓴다.** 성공이 「완료」 배지를 달면 기록에 늘 같은 값이 붙어
            아무것도 말하지 않는다. 성공은 왼쪽 체크가, 실패는 이 한 줄이 말한다. */}
        {block.status === "error" ? (
          <p className="text-xs text-[var(--el-error)]">실행하지 못했습니다</p>
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
 * 도구가 향하는 곳. **모르는 `kind`가 와도 화면이 안 깨진다** — 그릴 줄 아는 둘만 칩으로
 * 세우고 나머지는 아무것도 안 그린다. 위에서 `summary`가 이미 무엇을 하는지 말했다.
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

function Dot({ state }: { state: "complete" | "active" | "error" | "pending" }) {
  if (state === "active")
    return (
      <Loader2
        aria-hidden
        className="mt-[3px] size-3 shrink-0 animate-spin text-[var(--el-muted)]"
      />
    );
  if (state === "complete")
    return (
      <Check aria-hidden className="mt-[3px] size-3 shrink-0 text-[var(--el-muted)]" />
    );
  if (state === "error")
    return (
      <X aria-hidden className="mt-[3px] size-3 shrink-0 text-[var(--el-error)]" />
    );
  return (
    <span
      aria-hidden
      className="mt-[6px] size-1.5 shrink-0 rounded-full bg-[var(--el-hairline-strong)]"
    />
  );
}

/**
 * 답변 아래 근거 줄. **`refs`의 회의록 수로 web이 문구를 만든다.**
 *
 * 번호 각주 ①②③과 인용 카드는 2단계다 — 지금 계약의 `refs`는 「에이전트가 본 것」이지
 * 「어느 문장을 뒷받침하는지」가 아니라, 그걸 각주로 그리면 없는 정확도를 주장하게 된다.
 *
 * ★ **접힌다. 그런데 기본이 개수에 따라 갈린다.**
 *
 * 답이 길어지면 이 줄이 늘 펼쳐진 채로 그만큼 자리를 먹는다. 그래서 접을 수 있게 하되,
 * **접어서 아낄 것이 있을 때만 접어 둔다.**
 *
 * - 1건이면 편다. 줄이 이미 그 회의 이름을 말하고 있어 접어도 감춰지는 것이 없는 대신,
 *   칩 하나뿐이라 **아낄 자리도 없다.** 그 칩이 그 회의록으로 가는 유일한 문이라 한 번
 *   더 누르게 만들 이유가 없다.
 * - 여럿이면 접는다. 줄이 개수만 말하므로(「이 답은 3개 회의를 봤습니다」) 감춰지는 것이
 *   있지만, 칩들이 여러 줄로 늘어나 자리를 먹는 것도 이쪽이다. 개수를 먼저 보이고
 *   이름은 물을 때 준다.
 *
 * **`<details>` 를 쓴다.** 열림 상태·키보드·`aria-expanded` 를 브라우저가 준다. 위
 * `Disclosure` 가 버튼과 state 로 된 것은 **`live` 를 따라 저절로 여닫아야 해서**이고,
 * 여기는 그럴 것이 없다. 생김새는 그쪽과 맞춘다(같은 쉐브론, 같은 회전).
 *
 * `open` 은 `refs` 가 정하는데 `refs` 는 답이 끝난 뒤 한 번에 오므로(`message_end`)
 * 값이 도중에 안 바뀐다 — React 가 사용자의 여닫기를 되돌릴 일이 없다.
 */
export function AnswerRefs({
  refs,
  onOpenNote,
}: {
  refs: { id: string; title: string }[];
  onOpenNote?: (noteId: string) => void;
}) {
  if (refs.length === 0) return null;
  return (
    <details
      data-refs="answer"
      open={refs.length === 1}
      className="chat-rise group mt-2 border-t border-dashed border-[var(--el-hairline)] pt-2"
    >
      {/* 기본 삼각형은 뗀다 — 쉐브론이 이미 그 일을 하고, 둘이 서면 표식이 두 개다. */}
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-[var(--el-muted)] [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-3.5 shrink-0 transition-transform group-open:rotate-90"
        />
        {/* ★ **문구를 안 바꾼다.** `refs` 수로 web 이 만드는 이 두 줄에 판정이 걸려 있다. */}
        {refs.length === 1
          ? `찾은 곳: ${refs[0].title} 1건`
          : `이 답은 ${refs.length}개 회의를 봤습니다`}
      </summary>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {refs.map((ref) => (
          <button
            key={ref.id}
            type="button"
            onClick={() => onOpenNote?.(ref.id)}
            disabled={!onOpenNote}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--el-hairline-strong)] px-2 py-0.5 text-[11px] text-[var(--el-body)] disabled:opacity-60 enabled:hover:border-[var(--el-ink)]"
          >
            <FileText aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{ref.title}</span>
          </button>
        ))}
      </div>
    </details>
  );
}


export type { ApprovalDecision };
