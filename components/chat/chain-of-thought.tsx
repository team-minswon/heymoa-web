"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { useTranslations } from "next-intl";

import {
  groupSteps,
  type Block,
  type ApprovalDecision,
  type StepLine,
} from "@/lib/chat/blocks";
import { cn } from "@/lib/utils";

const COLLAPSE_TRANSITION = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.22,
};

export type StepBlock = Exclude<Block, { kind: "text" }>;

const RAIL = "border-l border-[var(--el-hairline-strong)] pl-3.5";

function drawable(blocks: StepBlock[]) {
  return blocks.filter((block) => !isPendingApproval(block));
}

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
  live: boolean;
  startedAt?: string | null;
  endedAt?: string | null;
  onOpenNote?: (noteId: string) => void;
}) {
  const drawn = drawable(blocks);
  const seconds = useThinkingSeconds(live, startedAt, endedAt);
  if (drawn.length === 0) return null;

  const running = live && drawn.length === blocks.length;

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

export const STALL_MS = 20_000;

export function useStalled(signature: string, active: boolean): boolean {
  const [stalled, setStalled] = useState<{ at: string; on: boolean }>({
    at: signature,
    on: false,
  });
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

type ThoughtT = ReturnType<typeof useTranslations<"chat.thought">>;

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

export function LiveHead({
  seconds,
  open,
}: {
  seconds: number | null;
  open?: boolean;
}) {
  const t = useTranslations("chat.thought");
  return (
    <>
      <span className="font-medium text-[var(--el-body-strong)]">
        {t("thinking")}
      </span>
      {seconds !== null ? (
        <span
          aria-hidden
          className="whitespace-pre text-[var(--el-muted)] tabular-nums"
        >
          {` · ${duration(seconds, t)}`}
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

export function CurrentLine({
  id,
  text,
  stalled,
}: {
  id: string;
  text: string;
  stalled: boolean;
}) {
  const t = useTranslations("chat.thought");
  return (
    <p
      key={stalled ? "stalled" : id}
      data-current
      data-stalled={stalled || undefined}
      aria-hidden
      className="chat-rise h-5 min-w-0 truncate text-[13px] leading-5"
    >
      {stalled ? (
        <span className="text-[var(--el-muted)]">{t("stalled")}</span>
      ) : (
        <span className="chat-shimmer">{text}</span>
      )}
    </p>
  );
}

export function PendingProgress({ startedAt }: { startedAt: string | null }) {
  const seconds = useThinkingSeconds(true, startedAt);
  const stalled = useStalled("pending", true);
  const t = useTranslations("chat.thought");
  return (
    <div data-testid="chat-thinking" className="flex flex-col gap-0.5">
      <p className="flex h-6 items-center text-[13px]">
        <LiveHead seconds={seconds} />
      </p>
      <CurrentLine id="pending" text={t("pending")} stalled={stalled} />
      <span className="sr-only" aria-live="polite">
        {stalled ? t("stalled") : t("thinkingNow")}
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
  live: boolean;
  running: boolean;
  seconds: number | null;
  onOpenNote?: (noteId: string) => void;
}) {
  const t = useTranslations("chat.thought");
  const lines = groupSteps(blocks);
  const [open, setOpen] = useState(live);
  const reduced = useReducedMotion();
  const touched = useRef(false);

  useEffect(() => {
    if (touched.current) return;
    setOpen(live);
  }, [live]);

  const stalled = useStalled(stepSignature(blocks), running);
  const tail = running && open;
  const tailRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const pinned = useRef(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 렌더마다 다시 잰다. `[tail, overflow]` 로 묶으면 줄이 늘어도 안 재서 바닥을 못 따라간다
  useLayoutEffect(() => {
    const el = tailRef.current;
    if (el && tail && pinned.current) el.scrollTop = el.scrollHeight;
    const next = !!el && el.scrollHeight > el.clientHeight;
    if (next !== overflow) setOverflow(next);
  });

  return (
    <div
      data-cot="group"
      data-open={open ? "true" : "false"}
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
          {running ? (
            <LiveHead seconds={seconds} open={open} />
          ) : (
            <>
              <span className="truncate text-[var(--el-muted)] tabular-nums">
                {headline(blocks, live, seconds, t)}
              </span>
              <Chevron open={open} />
            </>
          )}
        </span>
      </button>
      {running ? (
        <span className="sr-only" aria-live="polite">
          {stalled ? t("stalled") : announceStep(blocks, t)}
        </span>
      ) : null}
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
            <div
              ref={tailRef}
              onScroll={(event) => {
                const el = event.currentTarget;
                pinned.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 8;
              }}
              data-tail={tail || undefined}
              data-overflow={(tail && overflow) || undefined}
              className={cn(
                "mt-1.5 mb-1 ml-1",
                RAIL,
                tail &&
                  `${LIVE_TAIL} overflow-y-auto overscroll-contain [scrollbar-width:thin]`,
                tail &&
                  overflow &&
                  "[mask-image:linear-gradient(to_bottom,transparent,black_0.75lh)]"
              )}
            >
              <motion.div
                layout={tail && !reduced ? "position" : false}
                data-motion={tail && !reduced ? "slide" : undefined}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="space-y-1.5"
              >
                {lines.map((line, index) => (
                  <TimelineLine
                    key={line.key}
                    line={line}
                    live={running && index === lines.length - 1}
                    animate={live}
                    onOpenNote={onOpenNote}
                  />
                ))}
                {running && stalled ? (
                  <div className="chat-rise flex gap-2" data-stalled>
                    <Dot state="pending" />
                    <p className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--el-muted)]">
                      {t("stalled")}
                    </p>
                  </div>
                ) : null}
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const LIVE_TAIL = "text-xs leading-relaxed max-h-[calc(4lh+1.125rem)]";

function duration(seconds: number, t: ThoughtT) {
  const hours = Math.floor(seconds / 3600);
  if (hours > 0)
    return t("duration.hours", {
      hours,
      minutes: Math.floor(seconds / 60) % 60,
      seconds: seconds % 60,
    });
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return t("duration.seconds", { seconds: rest });
  return rest === 0
    ? t("duration.minutes", { minutes })
    : t("duration.minutesSeconds", { minutes, seconds: rest });
}

function thinkingLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function announceStep(blocks: StepBlock[], t: ThoughtT): string {
  const pending = blocks.findLast(
    (block) => block.kind === "tool" && block.status === null
  );
  const label =
    pending?.kind === "tool"
      ? (pending.summary || pending.tool || "").split(" · ")[0]
      : "";
  return label ? t("step", { label }) : t("thinkingNow");
}

function TimelineLine({
  line,
  live,
  animate,
  onOpenNote,
}: {
  line: StepLine;
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

function headline(
  blocks: StepBlock[],
  live: boolean,
  seconds: number | null,
  t: ThoughtT
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
  const lead = live
    ? t("awaiting")
    : seconds !== null
      ? t("thoughtFor", { duration: duration(seconds, t) })
      : t("thought");
  const what = [
    notes.size > 0 ? t("notes", { count: notes.size }) : null,
    projects.size > 0 ? t("projects", { count: projects.size }) : null,
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
  animate: boolean;
  onOpenNote?: (noteId: string) => void;
}) {
  const t = useTranslations("chat.thought");
  const row = cn(animate && "chat-rise", "flex gap-2");
  if (block.kind === "thinking") {
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
        {block.status === "error" ? (
          <p className="text-xs text-[var(--el-error)]">{t("failed")}</p>
        ) : null}
        {block.status === "stopped" ? (
          <p className="text-xs text-[var(--el-muted)]">{t("stopped")}</p>
        ) : null}
        {block.status === "unknown" ? (
          <p className="text-xs font-medium text-[var(--el-body-strong)]">
            {t("check")}
          </p>
        ) : null}
        {block.url ? (
          <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--el-ink)] underline underline-offset-2"
          >
            {t("open")}
            <ExternalLink aria-hidden className="size-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

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

const REFS_SHOWN = 3;

export function AnswerRefs({
  refs,
  animate = false,
  onOpenNote,
}: {
  refs: { id: string; title: string }[];
  animate?: boolean;
  onOpenNote?: (noteId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("chat.thought");
  if (refs.length === 0) return null;
  const shown = expanded ? refs : refs.slice(0, REFS_SHOWN);
  const hidden = refs.length - shown.length;

  return (
    <div
      data-refs="answer"
      role="group"
      aria-label={t("refs", { count: refs.length })}
      className={cn(animate && "chat-rise", "flex flex-wrap gap-1.5")}
    >
      {shown.map((ref) => (
        <button
          key={ref.id}
          type="button"
          onClick={() => onOpenNote?.(ref.id)}
          disabled={!onOpenNote}
          title={t("openRef", { title: ref.title })}
          className="inline-flex min-h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-[14px] border border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-2.5 py-1 text-left text-xs leading-[1.4] text-[var(--el-body)] outline-none transition-colors pointer-coarse:min-h-9 enabled:hover:border-[var(--el-hairline-strong)] enabled:hover:bg-[var(--el-canvas-soft)] enabled:hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-60"
        >
          <FileText
            aria-hidden
            className="size-3.5 shrink-0 self-start mt-px text-[var(--el-scope-note)]"
          />
          <span className="[overflow-wrap:anywhere]">{ref.title}</span>
        </button>
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          aria-label={t("moreRefs", { count: hidden })}
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
