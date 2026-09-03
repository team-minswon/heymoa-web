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
 * 연속된 생각·도구·승인을 접이식 묶음 하나로.
 *
 * **직접 만든다.** AI Elements와 assistant-ui는 AI SDK의 `UIMessage` part에 강결합인데
 * heymoa는 서버 중계형 SSE다. 구조만 참고했다.
 *
 * 문구는 여기서 만든다 — ai는 구조만 내린다. 계약에는 없고 블록을 보고 web이 쓴다.
 */

/**
 * 접었다 펴는 움직임. **눌린 만큼만 열린다** — `note-summary` 의 근거 목록이 쓰는 것과
 * 같은 값이다. 두 곳이 다른 속도로 열리면 같은 화면에서 따로 논다.
 */
const COLLAPSE_TRANSITION = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.22,
};

export type StepBlock = Exclude<Block, { kind: "text" }>;

/**
 * 과정은 **답변 옆의 여백 메모**다. 카드가 아니다.
 *
 * 예전에는 흰 배경에 테두리를 두른 상자였다 — 답변 말풍선과 같은 무게라, 무엇이 결과이고
 * 무엇이 그 결과에 이르는 길인지가 눈으로 안 갈렸다. 세로선 한 줄이면 「이건 곁가지」가
 * 말해진다. 승인 기록이 이미 쓰던 모양이라 둘이 같은 자리에 선다.
 */
const RAIL = "border-l border-[var(--el-hairline-strong)] pl-3.5";

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

  /**
   * ★ **하나여도 서랍이다.**
   *
   * 예전에는 하나면 평평하게 그렸다 — 「접었다 폈다 할 것이 하나인 서랍은 서랍이 아니다」가
   * 이유였고, 정지 화면만 보면 맞는 말이다. 그런데 **단계는 하나로 시작해서 늘어난다.**
   * 실측하면 첫 단계에서 `single`, 둘째가 오는 순간 `group` 으로 갈아끼워져 머리글이 없다가
   * 생기고 레일이 통째로 다시 마운트된다 — 도는 중에 화면이 한 번 튄다.
   *
   * 모양이 개수에 따라 갈리지 않는 쪽이 낫다. 하나든 여섯이든 같은 서랍이고, 그래서
   * 「지금 무엇을 하고 있나」를 찾는 자리가 항상 같은 곳이다.
   */
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
  /**
   * ★ **접어서 아낄 것이 있을 때만 접어 둔다.**
   *
   * 도는 동안은 펴 둔다(지금 무엇을 하는지가 그 안에 있다). 끝나면 접는데, **줄이 하나면
   * 접어도 아끼는 자리가 없다** — 머리글 한 줄로 본문 한 줄을 가리는 셈이라 누르는 수고만
   * 늘고 화면은 그대로다. 「참고한 회의록」이 1건에서 편 채로 서는 것과 같은 규칙이다.
   */
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
      // ★ **떠오르는 것은 흐를 때 한 번이다.** 끝난 묶음은 히스토리 컴포넌트로 다시
      // 마운트되는데, 거기서 또 떠오르면 방금 본 레일이 한 번 더 번쩍인다(2026-09-03 실측).
      className={cn(live && "chat-rise", RAIL)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          touched.current = true;
          setOpen((value) => !value);
        }}
        // ★ **손잡이를 여기서 말한다.** `@layer base` 의 `button { cursor: pointer }` 에
        // 기대면 Tailwind 를 올릴 때 조용히 뒤집힌다 — 아래 「찾은 곳」의 `<summary>` 도
        // 같은 이유로 자기 커서를 들고 있다. 여닫는 두 곳이 같은 말을 하게 둔다.
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
        {/* ★ **접혀서 도는 동안에만 지금 하는 일을 말한다.**
            접힌 줄이 「생각 과정」이라고만 하면 그때 알고 싶은 것(**지금 뭘 하고 있나**)에
            아무 답이 없다. ChatGPT·Claude 가 도구 이름을 헤더에 세웠다가 접는 자리다.

            **펴져 있으면 안 되풀이한다.** 바로 아래 줄이 같은 글자를 이미 말하고 있어서,
            둘 다 세우면 같은 문장이 두 벌로 서고 빛도 두 군데서 지나간다. */}
        <span
          className={cn(
            "min-w-0 truncate text-xs",
            running && !open ? "chat-shimmer" : "text-[var(--el-muted)]"
          )}
        >
          {running && !open ? currentStep(blocks) : headline(blocks)}
        </span>
      </button>
      {/* **탁 열리지 않는다.** 높이가 0에서 제 높이까지 자란다 — `note-summary` 의 근거
          목록과 같은 값이라 같은 화면에서 결이 맞는다. `initial={false}` 는 흐르는 중에
          이미 펴진 채로 다시 그려질 때 매 토큰 다시 자라지 않게 한다. */}
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
              {/* ★ **단계 사이의 빈 구간.** 도구 결과가 오고 다음 생각·토큰이 오기까지
                  모델이 도는 몇 초가 있다. 마지막 줄은 체크로 굳었고 빛나는 글자가 없어
                  멈춘 것처럼 보였다. 그 사이만 이 줄이 선다. */}
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
 * 지금 도는 줄이 무엇인가. **그리는 마지막 줄**이 곧 그것이다 — 승인 대기는 이미
 * 걸러졌고(`drawable`), 도구 결과가 오면 그 줄이 끝난 것으로 바뀐다.
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
 * 마지막 단계는 끝났는데 다음이 아직 안 왔다. 생각은 마지막이면 언제나 도는 중이고(그 줄이
 * 빛난다), 도구는 결과가 왔으면 끝, 승인은 확정 전이면 이미 걸러졌으니 확정된 것만 온다.
 */
function betweenSteps(blocks: StepBlock[]): boolean {
  const last = blocks.at(-1);
  if (!last || last.kind === "thinking") return false;
  // 승인된 도구는 승인 블록 **뒤가 아니라 앞**에 서 있고 결과가 올 때까지 `status: null` 이다.
  // 마지막만 보면 그 실행 중에 「생각하는 중」이 겹친다.
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

/**
 * 끝난 묶음의 이름. **무엇을 봤는지**까지 말한다 — 이름만 있으면 접힌 채로는 아무 정보가
 * 없다. 도는 동안에는 이 자리를 `currentStep` 이 대신한다.
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

  // ★ **개수를 안 센다.** 「3단계」는 사람이 쓰는 말이 아니고 — 몇 번 돌았는지는 접힌
  // 줄이 답할 일이 아니다. 펴면 줄마다 무엇을 했는지가 이미 적혀 있다. 접힌 줄이 말할
  // 것은 **무엇에 대한 생각이었나** 하나다(ChatGPT 의 "Thought for 8s", Claude 의
  // "Thought process" 가 같은 자리다).
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
        {/* 생각이 여럿이면 줄바꿈으로 온다 — `whitespace-pre-line`이 없으면 「찾습니다.
            전사에서」처럼 두 문장이 한 줄로 붙어 버린다. */}
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
          {/* ★ **도구 id 로 안 흘러내린다.** 카드는 `summary`(「Linear 이슈 'APP 버그
              수정' 생성」)로 물었는데 여기서 `linear.create_issue` 로 답하면, 같은 한 번의
              일을 두 화면이 다른 이름으로 부른다. 계약이 `summary` 를 저장하지 않아
              새로고침 뒤에는 사람 말을 되살릴 방법이 없으므로 — **덜 말하되 다른 말을
              하지 않는다.** 무엇을 했는지는 바로 아래 실행 기록이 잇는다. */}
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
            : block.status
              ? "complete"
              : "active"
        }
      />
      <div className="min-w-0 flex-1">
        {/* ★ **도는 줄은 글자 자신이 빛난다.** 왼쪽 점이 이미 도는데 그것만으로는 어느
            줄이 지금인지 눈에 안 걸린다 — Claude 가 도구 이름에 빛을 지나가게 하는 것과
            같은 자리다. 끝나면 빛이 멈추고 점이 체크로 바뀐다. */}
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
 * - 여럿이면 접는다. 줄이 개수만 말하므로 감춰지는 것이 있지만, 칩들이 여러 줄로
 *   늘어나 자리를 먹는 것도 이쪽이다. 개수를 먼저 보이고 이름은 물을 때 준다.
 *
 * ★ **`<details>` 를 안 쓴다.** 열림 상태·키보드를 브라우저가 준다는 것이 이유였는데,
 * 그 대가로 **여는 움직임을 못 만든다** — 브라우저가 내용을 즉시 붙였다 뗀다. 위
 * `Disclosure` 와 같은 버튼 + state 로 바꾸고 높이를 애니메이션한다. `aria-expanded` 는
 * 손으로 붙인다. 생김새·움직임이 그쪽과 한 벌이 되는 것이 덤이 아니라 요점이다.
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
  // 하나뿐이면 접어도 아낄 자리가 없고, 그 칩이 회의록으로 가는 유일한 문이다.
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
        {/* ★ **「출처」라고 안 한다.** 계약이 싣는 것은 **본 것**이지 인용한 것이 아니다 —
            네 개를 보고 하나만 근거로 썼어도 넷이 다 여기 선다. 「출처」는 그것보다 더
            말하는 단어라 신뢰를 잘못 만든다. 「참고한」이 실제로 한 일이다. */}
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
