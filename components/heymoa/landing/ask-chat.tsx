"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight } from "lucide-react";
import { useMessages, useTranslations } from "next-intl";

import { useDemoCopy, type Ask } from "@/components/heymoa/landing/use-demo";
import { cn } from "@/lib/utils";

import {
  Answer,
  AppWindow,
  Composer,
  Face,
  RailHead,
  ScopeChip,
  ThreadTitle,
  UserBubble,
  type Person,
} from "./app";
import { AnswerRefs } from "./app-client";
import { useFollowBottom, useOnceInView, useReducedMotion } from "./hooks";
import { Cursor, Scribble, Sticky } from "./marks";
import { CONTAINER, FOCUS, LABEL, SHADOW, vars } from "./tokens";

const HEAD_NARROW =
  "@max-xs:h-auto @max-xs:flex-wrap @max-xs:gap-y-0 @max-xs:pt-1 @max-xs:pb-2.5 @max-xs:[&>.truncate]:order-last @max-xs:[&>.truncate]:basis-full @max-xs:[&>.truncate]:pl-[23px]";

const LOOKS: Array<{ who: Person; look: string; tilt: string; indent: string }> = [
  { who: "jihoon", look: "bg-[var(--tv-pop)]", tilt: "-rotate-1 lg:-rotate-2", indent: "" },
  {
    who: "seoyeon",
    look: "border-[1.5px] border-[var(--tv-ink)] bg-white",
    tilt: "rotate-1 lg:rotate-[1.5deg]",
    indent: "lg:ml-8",
  },
  { who: "woojae", look: "bg-[var(--tv-butter)]", tilt: "-rotate-1", indent: "lg:ml-3" },
];

type Question = (typeof LOOKS)[number] & {
  scene: string;
  ask: Ask;
  mark: string;
  note: readonly string[];
};

function useQuestions(): Question[] {
  const { asks } = useDemoCopy();
  const copy = useMessages().landing.ask.questions;
  return useMemo(
    () => LOOKS.map((look, i) => ({ ...look, ...copy[i], ask: asks[i] })),
    [asks, copy]
  );
}

const AUTO = 1;

const PEN =
  "tv-mark bg-[linear-gradient(color-mix(in_srgb,var(--tv-pop)_55%,transparent),color-mix(in_srgb,var(--tv-pop)_55%,transparent))] bg-no-repeat [background-size:100%_0.62em] [background-position:0_92%] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]";

const THINKING = -1;
const THINK_MS = 620;
const STEP = 2;
const STEP_MS = 16;
const AT = { cursor: 500, press: 1000, cursorOff: 1700, auto: 3500 } as const;

type Run = { i: number; n: number; mine: boolean };

function Marked({
  text,
  mark,
  className,
}: {
  text: string;
  mark: string;
  className?: string;
}) {
  const at = text.indexOf(mark);
  if (!className || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className={className}>{mark}</span>
      {text.slice(at + mark.length)}
    </>
  );
}

function SideNote({
  at,
  tone,
  tilt,
  children,
}: {
  at: "refs" | "mark";
  tone: "pop" | "butter";
  tilt: number;
  children: readonly string[];
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-[calc(100%+28px)] z-10 hidden -translate-y-1/2 items-center min-[1400px]:supports-[anchor-name:--a]:flex",
        at === "refs"
          ? "top-[anchor(center)] [position-anchor:--ask-refs]"
          : "top-[anchor(center)] [position-anchor:--ask-mark]"
      )}
    >
      <Scribble
        kind="arrow"
        flipX
        rotate={-14}
        className="absolute top-1/2 -left-9 h-6 w-9 -translate-y-1/2"
      />
      <Sticky
        tone={tone}
        size="sm"
        tilt={tilt}
        className="tv-bump w-max origin-left"
      >
        <span className="block">{children[0]}</span>
        <span className="block">{children[1]}</span>
      </Sticky>
    </span>
  );
}

export function AskChat({ heading }: { heading: ReactNode }) {
  const t = useTranslations("landing.ask");
  const { title, threadTitle, seed } = useDemoCopy();
  const QUESTIONS = useQuestions();
  const messages = useMessages().landing;
  const { noteA: NOTE_A, seedMark: SEED_MARK } = messages.ask;
  const reduced = useReducedMotion();
  const [attach, seen] = useOnceInView<HTMLDivElement>({ threshold: 0.45 });
  const windowRef = useRef<HTMLDivElement | null>(null);
  const bind = useCallback(
    (el: HTMLDivElement | null) => {
      windowRef.current = el;
      return attach(el);
    },
    [attach]
  );

  const [refsOpen, setRefsOpen] = useState<boolean | null>(null);
  const [cursor, setCursor] = useState(false);
  const [noteA, setNoteA] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [shown, setShown] = useState(THINKING);
  const [said, setSaid] = useState("");
  const started = useRef(false);
  const count = useRef(0);

  const start = useCallback((i: number, mine: boolean) => {
    started.current = true;
    count.current += 1;
    setRun({ i, n: count.current, mine });
    setShown(THINKING);
  }, []);

  useEffect(() => {
    if (!seen || reduced) return;
    const timers = [
      window.setTimeout(() => setCursor(true), AT.cursor),
      window.setTimeout(() => {
        setRefsOpen((open) => open ?? true);
        setNoteA(true);
      }, AT.press),
      window.setTimeout(() => setCursor(false), AT.cursorOff),
      window.setTimeout(() => {
        if (!started.current) start(AUTO, false);
      }, AT.auto),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [seen, reduced, start]);

  useEffect(() => {
    if (!run || reduced) return;
    const full = QUESTIONS[run.i].ask.a;
    let at = 0;
    let timer = 0;
    const tick = () => {
      at = Math.min(at + STEP, full.length);
      setShown(at);
      if (at < full.length) timer = window.setTimeout(tick, STEP_MS);
      else if (run.mine) setSaid(t("arrived", { answer: full }));
    };
    timer = window.setTimeout(tick, THINK_MS);
    return () => window.clearTimeout(timer);
  }, [run, reduced, QUESTIONS, t]);

  const view = run ?? (reduced ? { i: AUTO, n: 0, mine: false } : null);
  const q = view ? QUESTIONS[view.i] : null;
  const full = q?.ask.a ?? "";
  const at = reduced ? full.length : shown;
  const done = q !== null && at >= full.length;
  const busy = q !== null && !done;
  const open = refsOpen ?? reduced;
  const showA = noteA || reduced;
  const noteB = q && done ? q.note : null;
  const band = noteB ?? (showA ? NOTE_A : null);

  const [convoRef, onScroll] = useFollowBottom([open, view?.n, at]);

  const ask = (i: number) => {
    if (busy) return;
    start(i, true);
    if (reduced) setSaid(t("arrived", { answer: QUESTIONS[i].ask.a }));
    windowRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
  };

  const chip = <ScopeChip kind="note" title={title} />;

  return (
    <div
      className={`${CONTAINER} mt-16 grid gap-10 lg:mt-6 lg:min-h-[640px] lg:grid-cols-[minmax(0,1fr)_540px] lg:items-start lg:gap-16`}
    >
      <div className="min-w-0">
        {heading}

        <p
          id="ask-try"
          className={cn(LABEL, "m-0 mt-10 flex items-center gap-2")}
        >
          {t("tryLabel")}
          <Scribble kind="arrow" className="hidden h-5 w-8 lg:block" />
        </p>
        <ul
          aria-labelledby="ask-try"
          className="m-0 mt-4 flex list-none flex-col gap-4 p-0"
        >
          {QUESTIONS.map((item, i) => {
            const current = view?.i === i;
            return (
              <li
                key={item.scene}
                className="tv-land"
                style={vars({
                  "--fx": `${-50 - i * 40}px`,
                  "--fr": `${i % 2 ? 3 : -3}deg`,
                })}
              >
                <button
                  type="button"
                  aria-current={current || undefined}
                  aria-disabled={busy || undefined}
                  onClick={() => ask(i)}
                  className={cn(
                    "relative flex min-h-11 w-full max-w-[400px] cursor-pointer items-center gap-3 rounded-[14px] px-4 py-3.5 text-left lg:w-[calc(100%-2rem)]",
                    "motion-safe:transition-[rotate,translate,opacity] motion-safe:duration-200",
                    "motion-safe:not-aria-disabled:hover:-translate-y-0.5 motion-safe:not-aria-disabled:hover:rotate-0",
                    "aria-disabled:cursor-default aria-disabled:opacity-60",
                    SHADOW.sticky,
                    FOCUS,
                    item.look,
                    item.tilt,
                    item.indent
                  )}
                >
                  <Face
                    who={item.who}
                    size={32}
                    className="shrink-0 self-start"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] leading-[1.4] font-extrabold text-[var(--tv-body)]">
                      {item.scene}
                      <span className="sr-only">, </span>
                    </span>
                    <span className="mt-0.5 block text-[16px] leading-[1.45] font-extrabold text-[var(--tv-ink)]">
                      {item.ask.q}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--tv-ink)] text-white"
                  >
                    <ArrowRight className="size-3.5 max-lg:rotate-90" />
                  </span>
                  {current ? (
                    <span
                      aria-hidden
                      className="absolute -top-2.5 right-4 rounded-full bg-[var(--tv-ink)] px-2 py-0.5 text-[11px] leading-[1.4] font-extrabold text-white">
                      {t("current")}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        ref={bind}
        className="relative mx-auto w-full max-w-[540px] min-w-0 lg:sticky lg:top-24 lg:mx-0"
      >
        {band ? (
          <span
            aria-hidden
            className="absolute right-4 -bottom-6 z-10 min-[1400px]:supports-[anchor-name:--a]:hidden"
          >
            <Sticky
              key={band.join(" ")}
              tone={noteB ? "butter" : "pop"}
              size="sm"
              tilt={-2}
              className="tv-bump origin-top whitespace-nowrap"
            >
              {band.join(" ")}
            </Sticky>
          </span>
        ) : null}

        <AppWindow
          as="figure"
          className="@container flex flex-col lg:max-h-[640px]"
        >
          <figcaption className="sr-only">
            {t("figcaption", { title })}
          </figcaption>
          <RailHead className={HEAD_NARROW} />
          <ThreadTitle title={threadTitle} />

          <div
            ref={convoRef}
            onScroll={onScroll}
            className="flex flex-col gap-4 px-5 pt-5 pb-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
          >
            <UserBubble chip={chip}>{` ${seed.q}`}</UserBubble>
            <div className="flex flex-col gap-1.5">
              <Answer>
                <Marked
                  text={seed.a}
                  mark={SEED_MARK}
                  className={showA ? PEN : undefined}
                />
              </Answer>
              <div className="relative">
                <AnswerRefs
                  refs={seed.refs}
                  open={open}
                  onOpenChange={setRefsOpen}
                  className="[anchor-name:--ask-refs]"
                />
                {cursor ? (
                  <Cursor
                    press
                    delay={50}
                    className="top-[25px] left-[106px]"
                  />
                ) : null}
              </div>
            </div>

            {view && q ? (
              <div key={view.n} className="flex flex-col gap-4">
                <UserBubble
                  chip={chip}
                  className={run ? "chat-rise" : undefined}
                >
                  {` ${q.ask.q}`}
                </UserBubble>
                {at === THINKING ? (
                  <p className="chat-shimmer m-0 text-xs">{messages.demo.thinking}</p>
                ) : !done ? (
                  <div aria-hidden>
                    <Answer>{full.slice(0, at)}</Answer>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <Answer>
                      <Marked
                        text={full}
                        mark={q.mark}
                        className={cn(PEN, "[anchor-name:--ask-mark]")}
                      />
                    </Answer>
                    <AnswerRefs
                      refs={q.ask.refs}
                      className={run ? "chat-rise" : undefined}
                    />
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <Composer
            chip={chip}
            busy={busy}
            className="mx-5 mb-4 border-transparent bg-[var(--el-canvas)]"
          />
        </AppWindow>

        {showA ? (
          <SideNote at="refs" tone="pop" tilt={3}>
            {NOTE_A}
          </SideNote>
        ) : null}
        {noteB ? (
          <SideNote
            key={noteB.join(" ")}
            at="mark"
            tone="butter"
            tilt={-3}
          >
            {noteB}
          </SideNote>
        ) : null}
      </div>

      <p role="status" className="sr-only">
        {said}
      </p>
    </div>
  );
}
