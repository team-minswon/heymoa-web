"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Pause, Play } from "lucide-react";
import { useMessages, useTranslations } from "next-intl";

import {
  useDemo,
  useInView,
  type Demo,
} from "@/components/heymoa/landing/use-demo";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import type { Messages } from "@/i18n/messages";
import { cn } from "@/lib/utils";

import { AppWindow, Face } from "./app";
import {
  ANSWERED_NARROW_MS,
  CHAPTER_OF,
  HOLD_MS,
  ROW_IN_MS,
  SCENE_TAB,
  sceneOf,
  type Moment,
  type Scene,
} from "./hero-data";
import { HeroNote } from "./hero-note";
import { HeroRail } from "./hero-rail";
import { useOnceInView, useReducedMotion } from "./hooks";
import { Hand, Scribble, Sticky } from "./marks";
import { RICH } from "./rich";
import { FOCUS, STAGE_WRAP, vars } from "./tokens";

function edgesIn(el: HTMLElement, host: HTMLElement) {
  let top = 0;
  let at: HTMLElement | null = el;
  while (at && at !== host) {
    top += at.offsetTop;
    const parent = at.offsetParent as HTMLElement | null;
    if (parent && parent !== host) top -= parent.scrollTop;
    at = parent;
  }
  return [top, top + el.offsetHeight] as const;
}

const noteMark = (host: HTMLElement) => {
  const mark = host.querySelector<HTMLElement>("[data-mark]");
  return mark?.querySelector<HTMLElement>("li:last-child") ?? mark;
};
const railMark = (host: HTMLElement) =>
  host.querySelector<HTMLElement>("[data-refs] button");

function markShown(
  target: HTMLElement,
  host: HTMLElement,
  top: number,
  bottom: number
) {
  const box = target.closest<HTMLElement>("[data-view]");
  if (box) {
    const [boxTop, boxBottom] = edgesIn(box, host);
    const cover = box.querySelector<HTMLElement>("[data-cover]");
    const floor = cover?.parentElement
      ? boxBottom -
        cover.parentElement.offsetHeight +
        (parseFloat(cover.style.top) || 0)
      : boxBottom - (Number(box.dataset.view) || 0);
    if (top < boxTop || bottom > floor) return false;
  }
  const below = host.querySelector<HTMLElement>("[data-note-floor]");
  return !below?.offsetParent || (top + bottom) / 2 + 48 <= below.offsetTop;
}

function useMarkEdges(
  find: (host: HTMLElement) => HTMLElement | null | undefined
) {
  const ref = useRef<HTMLDivElement>(null);
  const measure = useCallback(() => {
    const host = ref.current;
    if (!host) return;
    const target = find(host);
    if (!target?.offsetParent) {
      for (const name of ["--mt", "--mb", "--mvis"])
        host.style.removeProperty(name);
      return;
    }
    const [top, bottom] = edgesIn(target, host);
    host.style.setProperty("--mt", `${top}px`);
    host.style.setProperty("--mb", `${bottom}px`);
    host.style.setProperty(
      "--mvis",
      markShown(target, host, top, bottom) ? "visible" : "hidden"
    );
  }, [find]);
  useEffect(() => measure());
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      host.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);
  return ref;
}

function Voice({ line }: { line: NonNullable<Demo["live"]>["line"] }) {
  return (
    <span className="tv-pop flex items-end gap-1.5" style={{ rotate: "-2deg" }}>
      <Face who={line.who} size={26} className="shrink-0" />
      <span className="rounded-[16px] rounded-bl-[4px] border-[1.5px] border-[var(--tv-ink)] bg-white px-2.5 py-2 shadow-[0_6px_14px_-6px_rgba(60,40,0,0.35)]">
        <span className="line-clamp-3 text-[12px] leading-[1.45] font-bold text-[var(--tv-ink)]">
          {line.text}
        </span>
      </span>
    </span>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return (
    <span className="mt-0.5 block text-[12px] font-bold text-[var(--tv-body)]">
      {children}
    </span>
  );
}

type NoteKey = keyof Messages["landing"]["demo"]["notes"];

type Note = {
  text: NoteKey;
  sub?: NoteKey;
  tone: ComponentProps<typeof Sticky>["tone"];
  tilt: number;
  delay?: number;
  anyTab?: boolean;
};

const STEP_1: Note = {
  text: "step1",
  sub: "step1Sub",
  tone: "butter",
  tilt: -2,
};
const STEP_2: Note = {
  text: "step2",
  sub: "step2Sub",
  tone: "butter",
  tilt: 2,
  delay: 250,
  anyTab: true,
};

const BELOW: Partial<Record<Scene, Note>> = {
  listen: { text: "listen", tone: "butter", tilt: -2 },
  task: { text: "task", tone: "pop", tilt: 2, delay: ROW_IN_MS },
  open: { text: "open", tone: "peach", tilt: 2, delay: ROW_IN_MS },
};

const MARK_TOP =
  "clamp(calc(var(--a) + 120px), calc((var(--mt, 300px) + var(--mb, 340px)) / 2 - 40px), calc(100% - 92px))";

const CONFIRM: Note = {
  text: "confirm",
  sub: "confirmSub",
  tone: "pop",
  tilt: -3,
  delay: 200,
};

const ABOVE: Partial<Record<Scene, Note>> = {
  paused: STEP_2,
  press: STEP_2,
  ended: { text: "ended", tone: "pop", tilt: -2, anyTab: true },
  analyzing: { text: "analyzing", tone: "pop", tilt: 2 },
  doc: { text: "doc", tone: "mint", tilt: -2 },
};

function NoteSticky({ note }: { note: Note }) {
  const t = useTranslations("landing.demo");
  return (
    <Sticky
      tone={note.tone}
      tilt={note.tilt}
      anim="pop"
      delay={note.delay}
      className="block"
    >
      {t.rich(`notes.${note.text}`, RICH)}
      {note.sub ? <Sub>{t.rich(`notes.${note.sub}`, RICH)}</Sub> : null}
    </Sticky>
  );
}

function NoteNotes({
  demo,
  scene,
  tabOk,
}: {
  demo: Demo;
  scene: Scene;
  tabOk: boolean;
}) {
  const t = useTranslations("landing.demo");
  const live = demo.live;
  const typing = (live?.text.length ?? 0) > 0;
  const legend =
    tabOk && (scene === "timeline" || scene === "task" || scene === "open");
  const evidence = tabOk && (scene === "evidence" || scene === "confirm");
  const below =
    tabOk && (scene === "listen" ? typing : !typing) ? BELOW[scene] : undefined;
  const step = scene === "stop" || scene === "paused" || scene === "press";
  const stepArrow =
    scene === "stop" &&
    (demo.noteTab === "script" || demo.noteTab === "timeline");
  const e =
    ABOVE[scene] && (ABOVE[scene].anyTab || tabOk) ? ABOVE[scene] : null;
  const idle = scene === "open" && live?.line.at === "01:48";
  const voice =
    live !== null &&
    demo.status === "recording" &&
    (scene !== "listen" || typing);

  return (
    <>
      {legend ? (
        <div
          aria-hidden
          className="absolute top-[var(--a)] right-full -mr-3 hidden w-[132px] xl:block"
        >
          <Sticky tone="mint" tilt={-3} anim="pop" className="block">
            {t("notes.legend")}
            <span className="mt-1.5 flex flex-col gap-1 text-[13px] font-bold">
              <span className="flex items-center gap-1.5">
                <TimelineToneIcon tone="decision" />
                {t("filters.decision")}
              </span>
              <span className="flex items-center gap-1.5">
                <TimelineToneIcon tone="task" />
                <span
                  key={scene === "task" ? "bump" : "rest"}
                  className={
                    scene === "task"
                      ? "tv-bump [animation-delay:300ms]!"
                      : undefined
                  }
                >
                  {t("filters.task")}
                </span>
              </span>
              {scene === "open" ? (
                <span
                  className="tv-pop flex items-center gap-1.5"
                  style={vars({ "--d": `${ROW_IN_MS}ms` })}
                >
                  <TimelineToneIcon tone="open" />
                  {t("filters.open")}
                </span>
              ) : null}
            </span>
          </Sticky>
        </div>
      ) : null}

      {voice && live ? (
        <div
          aria-hidden
          className={cn(
            "absolute right-full -mr-2 hidden w-[140px] flex-col items-start gap-1 xl:flex",
            scene === "listen" ? "top-[var(--a)]" : "bottom-[96px]"
          )}
        >
          <span
            key={idle ? "idle" : "room"}
            className="relative ml-2 w-[104px]"
          >
            <Hand
              className={cn(
                "tv-pop block",
                idle ? "text-[12.5px]" : "text-[12px]"
              )}
            >
              {idle ? t("notes.idle") : t("notes.room")}
            </Hand>
            {scene === "listen" ? null : (
              <Scribble
                kind="arrow"
                draw="mount"
                className="absolute top-1 -right-[60px] h-6 w-10"
                rotate={20}
              />
            )}
          </span>
          <Voice key={live.line.at} line={live.line} />
        </div>
      ) : null}

      {evidence ? (
        <div
          aria-hidden
          className="absolute right-full -mr-2 hidden h-20 w-[150px] items-center [visibility:var(--mvis,visible)] xl:flex"
          style={{
            top: "calc((var(--mt, 220px) + var(--mb, 270px)) / 2 - 40px)",
          }}
        >
          <Sticky tone="pop" tilt={-3} anim="pop" delay={400} className="block">
            {t.rich("notes.evidence", RICH)}
          </Sticky>
          <Scribble
            kind="arrow"
            draw="mount"
            delay={600}
            rotate={20}
            className="absolute top-[calc(50%-16px)] -right-[56px] h-8 w-[52px]"
          />
        </div>
      ) : null}

      {below ? (
        <div
          key={scene}
          aria-hidden
          className="absolute right-full -mr-1 hidden h-20 w-[136px] items-center xl:flex"
          style={{ top: MARK_TOP }}
        >
          <NoteSticky note={below} />
          <Scribble
            kind="arrow"
            draw="mount"
            delay={180 + (below.delay ?? 0)}
            rotate={20}
            className="absolute top-[calc(50%-14px)] left-full -ml-3 h-7 w-10"
          />
        </div>
      ) : null}

      {step ? (
        <div
          aria-hidden
          className="absolute right-full bottom-3 -mr-6 hidden w-[168px] xl:block"
        >
          <NoteSticky note={STEP_1} />
          {stepArrow ? (
            <Scribble
              kind="arrow-long"
              draw="mount"
              delay={180}
              rotate={8}
              className="absolute left-full -bottom-[14px] -ml-2 h-[79px] w-[184px]"
            />
          ) : null}
        </div>
      ) : null}

      {scene === "confirm" && tabOk ? (
        <div
          aria-hidden
          data-note-floor
          className="absolute right-full bottom-3 -mr-6 hidden w-[168px] xl:block"
        >
          <NoteSticky note={CONFIRM} />
          <Scribble
            kind="arrow"
            draw="mount"
            delay={520}
            rotate={30}
            className="absolute -right-[100px] bottom-[14px] h-[60px] w-[96px]"
          />
        </div>
      ) : null}

      {e ? (
        <div
          aria-hidden
          className="absolute right-3 bottom-full mb-2 hidden xl:block"
        >
          <span
            key={e === STEP_2 ? "step-2" : scene}
            className="relative inline-block"
          >
            <NoteSticky note={e} />
            {e === STEP_2 ? (
              <Scribble
                kind="arrow-down"
                draw="mount"
                delay={420}
                className="absolute right-[60px] -bottom-5 h-6 w-3"
              />
            ) : null}
          </span>
        </div>
      ) : null}
    </>
  );
}

function RailNotes({ scene, askDone }: { scene: Scene; askDone: boolean }) {
  const t = useTranslations("landing.demo");
  if (scene !== "ask") return null;
  return (
    <>
      <div
        aria-hidden
        className="absolute top-[176px] left-full ml-2 hidden w-[124px] xl:block [@media(max-height:720px)]:top-12 [@media(min-height:721px)_and_(max-height:890px)]:top-[119px]"
      >
        <Sticky tone="white" tilt={3} anim="pop" className="block">
          {t("notes.railAsk")}
        </Sticky>
      </div>
      {askDone ? (
        <div
          aria-hidden
          className="absolute left-full ml-4 hidden w-[116px] [visibility:var(--mvis,visible)] xl:block"
          style={{
            top: "calc((var(--mt, 293px) + var(--mb, 321px)) / 2 - 52px)",
          }}
        >
          <Hand className="tv-pop block text-[13px]">
            {t("notes.railRefs")}
          </Hand>
          <Scribble
            kind="arrow"
            flipX
            draw="mount"
            delay={250}
            rotate={-40}
            className="absolute -bottom-6 -left-8 h-7 w-10"
          />
        </div>
      ) : null}
    </>
  );
}

/**
 * 데스크톱 창 높이(노트 · 레일 같이). 1440×900 은 500. 낮은 화면은 창 바닥이 보이는 높이 8px 위에 오도록
 * 줄인다 — 721~890 은 `100svh − 355`, 720 이하는 제목이 줄어 `100svh − 329`(계산은 머리 주석). 두 단은
 * **높이 범위로 가른다** — 둘 다 `max-height` 로 두면 Tailwind 가 720 단을 먼저 내보내 890 단이 이긴다.
 */
const WINDOW_H =
  "lg:h-[500px] lg:[@media(min-height:721px)_and_(max-height:890px)]:h-[clamp(360px,calc(100svh-355px),500px)] lg:[@media(max-height:720px)]:h-[clamp(300px,calc(100svh-329px),500px)]";

function Chapters({ chapter }: { chapter: number }) {
  const chapters = useMessages().landing.demo.chapters;
  const dot = (i: number) =>
    cn(
      "size-3 shrink-0 rounded-full transition-colors duration-300",
      i < chapter
        ? "bg-[var(--tv-brand)]"
        : i === chapter
          ? "bg-[var(--tv-pop)] ring-2 ring-[var(--tv-ink)]"
          : "bg-[var(--tv-rule-strong)]"
    );
  return (
    <div
      aria-hidden
      className="relative mt-5 flex items-center justify-center lg:mt-8 xl:mt-12"
    >
      <span className="hidden items-center gap-3.5 lg:flex">
        {chapters.map((name, i) => (
          <Fragment key={name}>
            {i > 0 ? (
              <span className="h-px w-7 bg-[var(--tv-rule-strong)]" />
            ) : null}
            <span
              className={cn(
                "inline-flex items-center gap-2.5 text-[17px] transition-colors duration-300",
                i === chapter
                  ? "font-extrabold text-[var(--tv-ink)]"
                  : "font-semibold text-[var(--tv-muted)]"
              )}
            >
              <span className={dot(i)} />
              {name}
            </span>
          </Fragment>
        ))}
      </span>
      <span className="flex items-center gap-1.5 lg:hidden">
        {chapters.map((name, i) => (
          <span key={name} className={dot(i)} />
        ))}
        <span className="ml-2 text-[16px] font-extrabold text-[var(--tv-ink)]">
          {chapters[chapter]}
        </span>
      </span>
    </div>
  );
}

export function HeroStage() {
  const t = useTranslations("landing.demo");
  const [visible, seen, attach] = useInView();
  const [watchNote, noteSeen] = useOnceInView<HTMLSpanElement>({
    threshold: 0,
    rootMargin: "0px 0px -16px 0px",
  });
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!seen || !noteSeen || armed) return;
    const id = window.setTimeout(() => setArmed(true), 800);
    return () => window.clearTimeout(id);
  }, [seen, noteSeen, armed]);
  const noteRef = useMarkEdges(noteMark);
  const railRef = useMarkEdges(railMark);

  const [held, setHeld] = useState<Moment | null>(null);
  const [lastMoment, setLastMoment] = useState<Moment>("listen");
  const demo = useDemo({ visible: visible && armed && held === null, seen });
  const scene = sceneOf(demo);
  const streaming =
    demo.typing !== null &&
    demo.typingAt >= 0 &&
    demo.typing < (demo.turns[demo.typingAt]?.a.length ?? 0);
  const askDone = scene === "ask" && !streaming;
  const typed =
    demo.live !== null && demo.live.text.length === demo.live.line.text.length;
  const moment: Moment = askDone
    ? "answered"
    : typed && scene === "listen"
      ? "typed"
      : typed && scene === "task"
        ? "asked"
        : typed && scene === "open"
          ? "idle"
          : scene;
  if (moment !== lastMoment) {
    setLastMoment(moment);
    setHeld(HOLD_MS[moment] ? moment : null);
  }
  useEffect(() => {
    if (held === null) return;
    const narrow =
      held === "answered" && !window.matchMedia("(min-width: 1280px)").matches;
    const id = window.setTimeout(
      () => setHeld(null),
      narrow ? ANSWERED_NARROW_MS : HOLD_MS[held]
    );
    return () => window.clearTimeout(id);
  }, [held]);

  const want = SCENE_TAB[scene];
  const tabOk = !want || want === demo.noteTab;
  const chapter = CHAPTER_OF[scene];
  const uid = useId();
  const capId = `${uid}-cap`;
  const PlayIcon = demo.paused ? Play : Pause;
  const caption = t(`captions.${scene}`);
  const still = useReducedMotion();

  return (
    <figure
      aria-labelledby={capId}
      className={cn(
        STAGE_WRAP,
        "tv-land relative mt-6 [--ts:0.94] [--ty:80px] max-lg:[@media(max-height:700px)]:mt-4 lg:mt-8 lg:[@media(max-height:890px)]:mt-3"
      )}
    >
      <figcaption id={capId} className="sr-only">
        {t(still ? "figcaption.still" : "figcaption.playing", {
          title: t("title"),
        })}
      </figcaption>

      <span
        aria-hidden
        className="tv-orb absolute -top-8 -left-8 hidden size-[240px] rounded-full bg-[var(--tv-butter)] [--os:1.3] [--ox:-40px] [--oy:170px] lg:block lg:[@media(max-height:890px)]:-top-3"
      />
      <span
        aria-hidden
        className="tv-orb absolute -right-4 -bottom-10 hidden size-[200px] rounded-full bg-[var(--tv-mint)] [--oe:1100px] [--os:1.4] [--ox:50px] [--oy:-230px] lg:block"
      />

      <div
        ref={attach}
        data-paused={demo.paused || undefined}
        className="tv-rise relative z-10 px-4 pt-14 max-lg:[@media(max-height:600px)]:pt-12 lg:rounded-[40px] lg:bg-[var(--tv-lav)] lg:px-8 lg:pb-6 xl:px-0"
      >
        <span
          aria-hidden
          className="absolute -top-3 left-3 size-[76px] rounded-full bg-[var(--tv-butter)] lg:hidden"
        />
        <span
          aria-hidden
          className="absolute -top-2 right-5 size-[56px] rounded-full bg-[var(--tv-mint)] lg:hidden"
        />
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-16 rounded-b-[40px] bg-[var(--tv-lav)] [@media(max-height:600px)]:h-14 lg:hidden"
        />

        <div className="absolute inset-x-4 top-3 max-lg:[@media(max-height:600px)]:top-2 lg:inset-x-8 xl:inset-x-0">
          <div className="mx-auto flex max-w-[960px] items-start gap-2.5">
            <button
              type="button"
              onClick={demo.togglePaused}
              className={cn(
                "relative inline-flex size-9 shrink-0 before:absolute before:-inset-1 before:rounded-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-white text-[13px] font-bold text-[var(--tv-ink)] shadow-[0_2px_6px_-2px_rgba(28,24,69,0.3)] transition-colors hover:bg-[var(--tv-butter-soft)] motion-reduce:hidden lg:w-auto lg:pr-3.5 lg:pl-3",
                FOCUS
              )}
            >
              <PlayIcon aria-hidden className="size-4" />
              <span className="sr-only lg:not-sr-only">
                {demo.paused ? t("play") : t("pause")}
              </span>
            </button>
            {tabOk && armed ? (
              <Sticky
                key={caption}
                tone="pop"
                size="sm"
                tilt={2}
                anim="pop"
                delay={scene === "open" ? ROW_IN_MS : 0}
                className="-mt-1 ml-auto shrink-0 xl:hidden"
              >
                {caption}
                {scene === "ask" ? (
                  <>
                    <span className="lg:hidden"> ↓</span>
                    <span className="hidden lg:inline"> →</span>
                  </>
                ) : scene === "stop" || scene === "confirm" ? (
                  <span className="lg:hidden"> ↓</span>
                ) : null}
              </Sticky>
            ) : null}
          </div>
        </div>

        <div className="relative mx-auto flex max-w-[960px] flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
          <div
            ref={noteRef}
            className="relative min-w-0 [--a:118px] lg:flex-1 lg:[@media(min-height:721px)_and_(max-height:890px)]:[--a:76px] lg:[@media(max-height:720px)]:[--a:16px]"
          >
            <span
              ref={watchNote}
              aria-hidden
              className="pointer-events-none absolute inset-x-0 h-px max-lg:top-16 lg:top-1/4"
            />
            <AppWindow
              className={cn(
                "tv-rise flex h-[clamp(340px,calc(100svh-480px),440px)] flex-col",
                WINDOW_H
              )}
              style={vars({ "--i": 1 })}
            >
              <HeroNote
                demo={demo}
                scene={scene}
                holding={held !== null}
                uid={uid}
              />
            </AppWindow>
            <NoteNotes demo={demo} scene={scene} tabOk={tabOk} />
          </div>
          <div ref={railRef} className="relative lg:w-[312px] lg:shrink-0">
            <AppWindow
              className={cn("tv-rise flex h-[380px] flex-col", WINDOW_H)}
              style={vars({ "--i": 2 })}
            >
              <HeroRail demo={demo} asking={scene === "ask"} />
            </AppWindow>
            <RailNotes scene={scene} askDone={askDone} />
          </div>
        </div>

        <Chapters chapter={chapter} />
      </div>
    </figure>
  );
}
