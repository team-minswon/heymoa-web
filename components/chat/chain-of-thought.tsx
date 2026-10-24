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

import {
  groupSteps,
  type Block,
  type ApprovalDecision,
  type StepLine,
} from "@/lib/chat/blocks";
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
  startedAt,
  endedAt,
  onOpenNote,
}: {
  blocks: StepBlock[];
  /** 이 묶음이 아직 흐르는 중인가. 도는 동안은 지금 단계 한 줄로 접고 끝나면 요약 한 줄로 접는다. */
  live: boolean;
  /**
   * 첫 단계의 시각(ISO). 히스토리 행, 커서 앞 히스토리, 또는 이 탭이 질문을 보낸 시각이 준다. 없으면 흐르는 동안
   * 마운트된 시각부터 잰다. 보낸 시각을 주면 첫 단계 전 「생각 중」 줄의 초가 이 묶음으로 끊기지 않고 이어진다.
   */
  startedAt?: string | null;
  /** 마지막 단계의 시각(ISO). 히스토리만 준다. 흐른 묶음은 `live` 가 꺼진 시각이 끝이다. */
  endedAt?: string | null;
  onOpenNote?: (noteId: string) => void;
}) {
  const drawn = drawable(blocks);
  const seconds = useThinkingSeconds(live, startedAt, endedAt);
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
      seconds={seconds}
      onOpenNote={onOpenNote}
    />
  );
}

/**
 * 생각한 초. 시각이 없는 경로는 짐작하지 않고 null 이다. 흐르는 동안은 1초마다 다시 잰다.
 */
export function useThinkingSeconds(
  live: boolean,
  startedAt: string | null | undefined,
  endedAt?: string | null
): number | null {
  const [mountedAt] = useState(() => (live ? Date.now() : null));
  const [now, setNow] = useState(() => Date.now());
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    // 흐름이 멈춘 시각이 끝이다. 다시 흐르면 `live` 쪽 갈래가 `now` 를 써서 이 값은 안 읽힌다.
    return () => {
      clearInterval(timer);
      setStoppedAt(Date.now());
    };
  }, [live]);

  const start = startedAt ? Date.parse(startedAt) : mountedAt;
  const end = endedAt ? Date.parse(endedAt) : live ? now : stoppedAt;
  if (start === null || end === null || Number.isNaN(start + end)) return null;
  const seconds = Math.floor((end - start) / 1_000);
  return seconds >= 1 ? seconds : null;
}

/**
 * 새 이벤트가 이만큼 없으면 「늦어지고 있어요」로 바꿔 말한다. 근거 있는 값이 아니다 — 도구 하나가 보통 몇 초 안에 끝나는
 * 목·실측 감각에서 고른 값이고, 연결이 죽었다고 판정하는 값(스트림 유휴 40초)보다 먼저 와야 한다.
 */
export const STALL_MS = 20_000;

/**
 * `signature` 가 `STALL_MS` 동안 안 바뀌었나. 초 타이머는 이벤트가 없어도 오르므로, 멈춘 것과 오래 걸리는 것을 가르려면
 * 마지막 이벤트로부터 잰다. 흐르지 않으면(`active` 거짓) 늘 거짓이다.
 */
export function useStalled(signature: string, active: boolean): boolean {
  const [stalled, setStalled] = useState<{ at: string; on: boolean }>({
    at: signature,
    on: false,
  });
  // 새 이벤트가 오면 렌더 중에 바로 푼다. effect 로 미루면 낡은 「늦어져요」가 한 번 그려진다
  if (stalled.at !== signature) setStalled({ at: signature, on: false });
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(
      () => setStalled({ at: signature, on: true }),
      STALL_MS
    );
    return () => clearTimeout(timer);
  }, [active, signature]);
  return active && stalled.at === signature && stalled.on;
}

const STALLED_TEXT = "응답이 늦어지고 있어요. 계속 기다리거나 멈출 수 있어요";

/** 블록이 바뀌었는지 가르는 값. 생각은 글자 수, 도구는 상태까지 본다. */
function stepSignature(blocks: StepBlock[]) {
  return blocks
    .map((block) =>
      block.kind === "thinking"
        ? `t${block.text.length}`
        : block.kind === "tool"
          ? `${block.toolCallId}:${block.status ?? "-"}`
          : `${block.approvalId}:${block.decision ?? "-"}`
    )
    .join("|");
}

/**
 * 흐르는 동안의 머리줄 「생각 중 · 8초」와 그 아래 지금 하는 일 한 줄. 첫 단계가 오기 전(`ThinkingLine`)과 단계가 흐르는
 * 동안(`Disclosure`)이 같은 이 모양을 써서, 첫 단계가 와도 줄이 바뀌거나 튀지 않는다. 두 줄 다 높이가 고정이다.
 *
 * 매초 바뀌는 초는 접근성 이름에서 뺀다 — 포커스가 있으면 매초 다시 읽힌다.
 */
export function LiveHead({
  seconds,
  open,
}: {
  seconds: number | null;
  /** 펼칠 수 있는 머리줄이면 지금 펼쳐져 있는가. 없으면 버튼이 아니다(첫 단계 전). */
  open?: boolean;
}) {
  return (
    <>
      <span className="font-medium text-[var(--el-body-strong)]">생각 중</span>
      {seconds !== null ? (
        // 플렉스 안이라 앞 공백이 접힌다 — `pre` 로 공백을 지킨다
        <span
          aria-hidden
          className="whitespace-pre text-[var(--el-muted)] tabular-nums"
        >
          {` · ${duration(seconds)}`}
        </span>
      ) : null}
      {open !== undefined ? <Chevron open={open} /> : null}
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      aria-hidden
      className={cn(
        "ml-0.5 size-3.5 shrink-0 text-[var(--el-muted)] transition-transform duration-200 motion-reduce:transition-none",
        open && "rotate-90"
      )}
    />
  );
}

/** 지금 하는 일 한 줄. 높이를 잡아 두어 문구가 바뀌거나 비어도 아래가 안 움직인다. */
export function CurrentLine({
  id,
  text,
  stalled,
}: {
  id: string;
  text: string;
  stalled: boolean;
}) {
  return (
    <p
      // 키는 단계의 정체로 준다. 문구로 주면 생각 델타마다 다시 마운트되어 떠오르기를 끝없이 되풀이한다.
      key={stalled ? "stalled" : id}
      data-current
      data-stalled={stalled || undefined}
      aria-hidden
      className="chat-rise h-5 min-w-0 truncate text-[13px] leading-5"
    >
      {stalled ? (
        <span className="text-[var(--el-muted)]">{STALLED_TEXT}</span>
      ) : (
        <span className="chat-shimmer">{text}</span>
      )}
    </p>
  );
}

/** 첫 단계가 오기 전의 진행 줄. 보낸 시각부터 초를 세고, 이벤트가 오래 없으면 늦어진다고 말한다. */
export function PendingProgress({ startedAt }: { startedAt: string | null }) {
  const seconds = useThinkingSeconds(true, startedAt);
  const stalled = useStalled("pending", true);
  return (
    <div data-testid="chat-thinking" className="flex flex-col gap-0.5">
      <p className="flex h-6 items-center text-[13px]">
        <LiveHead seconds={seconds} />
      </p>
      <CurrentLine
        id="pending"
        text="질문을 살펴보고 있어요"
        stalled={stalled}
      />
      <span className="sr-only" aria-live="polite">
        {stalled ? STALLED_TEXT : "생각하는 중"}
      </span>
    </div>
  );
}

function Disclosure({
  blocks,
  live,
  running,
  seconds,
  onOpenNote,
}: {
  blocks: StepBlock[];
  /** 이 턴이 아직 안 끝났나. 서랍 여닫기는 이 값을 따른다. */
  live: boolean;
  /**
   * 지금 도는 단계가 있나. 지금 단계 줄은 이 값을 따른다. 승인을 기다리는 동안은 `live` 인데
   * 도는 것은 없다.
   */
  running: boolean;
  seconds: number | null;
  onOpenNote?: (noteId: string) => void;
}) {
  const lines = groupSteps(blocks);
  // 도는 동안은 지금 단계 한 줄로 접는다. 승인을 기다릴 때는 무엇을 하려다 물었는지 보이게
  // 펴 둔다. 끝나면 접는다 — 본문은 답만 담고, 과정은 누른 사람만 본다.
  const auto = live && !running;
  const [open, setOpen] = useState(auto);
  const reduced = useReducedMotion();
  // 사용자가 손으로 건드렸으면 자동 접힘/펼침이 그걸 덮지 않는다.
  const touched = useRef(false);

  useEffect(() => {
    if (touched.current) return;
    setOpen(auto);
  }, [auto]);

  const current = running ? currentStep(blocks, lines) : null;
  const stalled = useStalled(stepSignature(blocks), running);

  return (
    <div
      data-cot="group"
      data-open={open ? "true" : "false"}
      // 떠오르는 것은 흐를 때 한 번이다. 끝난 묶음은 히스토리로 다시 마운트되는데 거기서 또
      // 떠오르면 한 번 더 번쩍인다.
      className={cn(live && "chat-rise", "flex flex-col")}
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
        className="-ml-1 flex h-6 w-fit max-w-full cursor-pointer items-center gap-0 rounded-control px-1 text-left text-[13px] outline-none hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex min-w-0 items-center truncate">
          {current ? (
            <LiveHead seconds={seconds} open={open} />
          ) : (
            <>
              <span className="truncate text-[var(--el-muted)] tabular-nums">
                {headline(blocks, live, seconds)}
              </span>
              <Chevron open={open} />
            </>
          )}
        </span>
      </button>
      {/* 접혀서 도는 동안에만 지금 하는 일을 한 줄로 말한다. 펴져 있으면 타임라인의 마지막 줄이 같은 말을 하므로
          되풀이하지 않는다. 사라질 때는 높이를 접어 아래 답이 한 번에 튀어 오르지 않게 한다. */}
      <AnimatePresence initial={false}>
        {current && !open ? (
          <motion.div
            key="current"
            initial={false}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : COLLAPSE_TRANSITION}
            className="overflow-hidden"
          >
            <CurrentLine
              id={current.id}
              text={current.text}
              stalled={stalled}
            />
            {/* 화면 읽기에는 단계가 바뀔 때만 알린다. 생각 문장은 델타마다 바뀌어 그대로 걸면 글자마다 읽힌다. */}
            <span className="sr-only" aria-live="polite">
              {stalled ? STALLED_TEXT : current.announce}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
            <div className={cn("mt-1.5 mb-1 ml-1 space-y-1.5", RAIL)}>
              {lines.map((line, index) => (
                <TimelineLine
                  key={line.key}
                  line={line}
                  live={running && index === lines.length - 1}
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
                    {stalled ? STALLED_TEXT : "생각하는 중"}
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

/** 「45초」·「2분 5초」. */
function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest}초`;
  return rest === 0 ? `${minutes}분` : `${minutes}분 ${rest}초`;
}

/** 생각 블록의 줄. ai 는 진행 문장 하나를 줄바꿈으로 끝내 보낸다 — 줄마다 한 단계다. 줄바꿈 없는 옛 생각은 한 줄이다. */
function thinkingLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * 지금 도는 단계. 결과를 기다리는 도구가 있으면 그것, 아니면 마지막 생각의 마지막 문장이다.
 * 승인 대기는 이미 걸러졌다(`drawable`). `announce` 는 화면 읽기에 알릴 짧은 말로, 생각이면
 * 문장 대신 「생각하는 중」이다.
 */
function currentStep(
  blocks: StepBlock[],
  lines: StepLine[]
): {
  id: string;
  text: string;
  announce: string;
} {
  const pending = blocks.findLast(
    (block) => block.kind === "tool" && block.status === null
  );
  if (pending?.kind === "tool") {
    const text = pending.summary || pending.tool || "생각하는 중";
    // 인자·결과를 뺀 라벨만 알린다(「연관 스크립트 읽기 중」). 길게 읽으면 다음 단계에 밀린다.
    const label = text.split(" · ")[0];
    return {
      id: `tool-${pending.toolCallId}`,
      text,
      announce: `${label} 중`,
    };
  }
  // 줄에서 읽는다. 커서 경계에서 갈려 온 생각은 줄에서 한 문단으로 합쳐져 있다.
  const last = lines.at(-1);
  if (last?.kind === "single" && last.block.kind === "thinking") {
    const rows = thinkingLines(last.block.text);
    const sentence = rows
      .at(-1)
      ?.split(/(?<=[.!?。])\s+/)
      .at(-1)
      ?.trim();
    return {
      // 줄이 늘 때마다 새 줄로 떠오른다. 같은 줄에 글자가 붙는 동안은 그대로다
      id: `${last.key}:${rows.length}`,
      text: sentence || "생각하는 중",
      announce: "생각하는 중",
    };
  }
  return { id: "pending", text: "생각하는 중", announce: "생각하는 중" };
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

/**
 * 펼친 타임라인의 한 줄. 묶인 조회 호출은 「라벨 ×N」 한 줄로 서고 누르면 호출마다 펼친다.
 * 개수는 요약 문구에서 읽지 않고 호출 수를 센다.
 */
function TimelineLine({
  line,
  live,
  animate,
  onOpenNote,
}: {
  line: StepLine;
  /** 지금 도는 줄인가. 묶음이면 그 안의 마지막 호출이 도는 것이다. */
  live: boolean;
  animate: boolean;
  onOpenNote?: (noteId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  if (line.kind === "single") {
    return (
      <StepRow
        block={line.block}
        live={live}
        animate={animate}
        onOpenNote={onOpenNote}
      />
    );
  }

  const active = line.blocks.some((block) => block.status === null);
  // 라벨은 ai 가 「라벨 · 인자 · 결과」로 내는 요약의 첫 마디다. 호출마다 다른 인자는 펴서 본다.
  const label = line.blocks[0].summary?.split(" · ")[0] || line.tool;
  return (
    <div data-step="run" className={cn(animate && "chat-rise")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer gap-2 text-left"
      >
        <Dot state={active && live ? "active" : "complete"} />
        <span className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--el-muted)]">
          {label} <span className="tabular-nums">×{line.blocks.length}</span>
          <ChevronRight
            aria-hidden
            className={cn(
              "ml-1 inline size-3 align-[-2px] transition-transform motion-reduce:transition-none",
              open && "rotate-90"
            )}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="calls"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : COLLAPSE_TRANSITION}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 pt-1.5 pl-5">
              {line.blocks.map((block) => (
                <StepRow
                  key={block.toolCallId}
                  block={block}
                  live={live && block === line.blocks.at(-1)}
                  animate={false}
                  onOpenNote={onOpenNote}
                />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * 끝난 묶음의 이름. 얼마나 생각했는지와 무엇을 봤는지만 말한다 — 단계 수는 사용자에게 뜻이 약해 펼쳐야 보인다.
 * 승인을 기다리며 펴져 있을 때는 아직 끝나지 않아 시간을 안 붙인다.
 */
function headline(
  blocks: StepBlock[],
  live: boolean,
  seconds: number | null
): string {
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
  const lead =
    !live && seconds !== null
      ? `${duration(seconds)} 동안 생각`
      : live
        ? "확인을 기다리는 중"
        : "생각 과정";
  const what = [
    notes.size > 0 ? `회의록 ${notes.size}건` : null,
    projects.size > 0 ? `프로젝트 ${projects.size}개` : null,
  ].filter(Boolean);

  return [lead, ...what].join(" · ");
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
    // 진행 문장은 줄마다 한 단계다. 줄바꿈 없이 이어진 옛 생각은 한 문단으로 읽힌다.
    const rows = thinkingLines(block.text);
    return (
      <>
        {rows.map((text, index) => {
          const active = live && index === rows.length - 1;
          return (
            <div key={index} className={row} data-step="thinking">
              <Dot state={active ? "active" : "complete"} />
              <p
                className={cn(
                  "min-w-0 flex-1 text-xs leading-relaxed",
                  active ? "chat-shimmer" : "text-[var(--el-muted)]"
                )}
              >
                {text}
              </p>
            </div>
          );
        })}
      </>
    );
  }

  // 확정 전 승인은 카드가 따로 서 있고, 결정된 승인은 `groupBlocks` 가 묶음을 끊고 카드로 세운다.
  if (block.kind === "approval") return null;

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

/** 근거 칩을 접지 않고 보이는 수. 넘으면 「+N」 하나로 접는다. */
const REFS_SHOWN = 3;

/**
 * 답변 아래 참고한 회의록. 머리말 없이 칩만 바로 보인다 — 1건짜리 접힘 서랍은 누를 일 하나를 늘릴 뿐이다. 칩을 누르면
 * 그 회의록으로 간다. `refs` 는 「본 것」이지 「어느 문장을 뒷받침하는지」가 아니라서 번호 각주로 그리지 않는다.
 *
 * 3개가 넘으면 「+N」으로 접고, 누르면 나머지가 선다. 답이 끝난 뒤에만 한 번 선다(부르는 쪽).
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
  const [expanded, setExpanded] = useState(false);
  if (refs.length === 0) return null;
  const shown = expanded ? refs : refs.slice(0, REFS_SHOWN);
  const hidden = refs.length - shown.length;

  return (
    <div
      data-refs="answer"
      role="group"
      // 「출처」가 아니다. 계약이 싣는 것은 인용한 것이 아니라 본 것이다.
      aria-label={`참고한 회의록 ${refs.length}개`}
      className={cn(animate && "chat-rise", "flex flex-wrap gap-1.5")}
    >
      {shown.map((ref) => (
        <button
          key={ref.id}
          type="button"
          onClick={() => onOpenNote?.(ref.id)}
          disabled={!onOpenNote}
          title={`${ref.title} 열기`}
          className="inline-flex min-h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-[14px] border border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-2.5 py-1 text-left text-xs leading-[1.4] text-[var(--el-body)] outline-none transition-colors pointer-coarse:min-h-9 enabled:hover:border-[var(--el-hairline-strong)] enabled:hover:bg-[var(--el-canvas-soft)] enabled:hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-60"
        >
          <FileText
            aria-hidden
            className="size-3.5 shrink-0 self-start mt-px text-[var(--el-scope-note)]"
          />
          {/* 자르지 않는다 — 길면 칩 안에서 줄을 바꾼다 */}
          <span className="[overflow-wrap:anywhere]">{ref.title}</span>
        </button>
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          aria-label={`참고한 회의록 ${hidden}개 더 보기`}
          onClick={() => setExpanded(true)}
          className="inline-flex h-7 cursor-pointer items-center rounded-full border border-dashed border-[var(--el-hairline-strong)] px-2.5 text-xs text-[var(--el-muted)] outline-none tabular-nums pointer-coarse:h-9 hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          +{hidden}
        </button>
      ) : null}
    </div>
  );
}

export type { ApprovalDecision };
