import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useMessages } from "next-intl";

import type { Person } from "@/components/heymoa/landing/app";
import type { TimelineTone } from "@/lib/notes/proposals/timeline";
import { prefersReducedMotion } from "@/lib/utils";

export type Line = { at: string; who: Person; text: string };

export const SPEAKER_LABEL: Partial<Record<Person, string>> = {
  minseo: "A",
  jihoon: "B",
  seoyeon: "C",
  woojae: "D",
};

export { FACE_KEY } from "@/components/heymoa/landing/shell";

const LINES: Array<Omit<Line, "text">> = [
  { at: "00:00", who: "minseo" },
  { at: "00:14", who: "jihoon" },
  { at: "00:31", who: "seoyeon" },
  { at: "00:44", who: "minseo" },
  { at: "01:02", who: "woojae" },
  { at: "01:19", who: "jihoon" },
  { at: "01:33", who: "seoyeon" },
  { at: "01:48", who: "minseo" },
];

export const LENGTH = "01:52";

export type Entry = {
  kind: "agenda" | "decision" | "question" | "insight" | "task";
  title: string;
  at: string;
  tone?: TimelineTone;
  meta?: "answered" | "waiting";
  cites?: number[];
  answer?: number;
};

const ENTRIES: Array<Omit<Entry, "title">> = [
  { kind: "agenda", at: "00:00" },
  { kind: "decision", tone: "decision", at: "00:00", cites: [0] },
  { kind: "decision", tone: "decision", at: "00:14", cites: [1] },
  { kind: "question", tone: "answered", at: "00:31", meta: "answered", cites: [2], answer: 4 },
  { kind: "insight", tone: "reference", at: "00:44", cites: [3] },
  { kind: "agenda", at: "01:02" },
  { kind: "task", tone: "task", at: "01:02", cites: [4] },
  { kind: "task", tone: "task", at: "01:19", cites: [5] },
  { kind: "question", tone: "open", at: "01:33", meta: "waiting", cites: [6] },
];

export const BASE_ENTRIES = 7;

export const FILTERS = ["all", "decision", "task", "open", "reference"] as const;
export type Filter = (typeof FILTERS)[number];

export const FILTER_OF: Record<TimelineTone, Filter> = {
  decision: "decision",
  task: "task",
  open: "open",
  answered: "reference",
  reference: "reference",
};

export const REVIEW_PARTS = 4;

export const NOTE_TABS = ["info", "script", "timeline", "summary"] as const;
export type NoteTab = (typeof NOTE_TABS)[number];

export type Status = "recording" | "paused" | "ended";

export type Ask = { q: string; a: string; refs: string[] };

export type Turn = Ask & { key: string; mine: boolean };

export function useDemoCopy() {
  const copy = useMessages().landing.demo;
  return useMemo(() => {
    const transcript: Line[] = LINES.map((line, i) => ({
      ...line,
      text: copy.lines[i],
    }));
    const timeline: Entry[] = ENTRIES.map((entry, i) => ({
      ...entry,
      title: copy.timeline[i],
    }));
    const seed: Ask = { ...copy.seed, refs: [copy.earlier, copy.title] };
    const asks: Ask[] = copy.asks.map((item) => ({
      ...item,
      refs: [copy.title],
    }));
    return {
      title: copy.title,
      project: copy.project,
      threadTitle: copy.threadTitle,
      transcript,
      timeline,
      seed,
      asks,
    };
  }, [copy]);
}

export const THINKING = -1;

const THINK_MS = 620;

const LOOP_GAP = 2400;

export const BASE_LINES = 5;

type Beat = { ms?: number; force?: true } & (
  | { t: "say"; i: number }
  | { t: "event" }
  | { t: "note"; v: NoteTab }
  | { t: "ask"; i: number }
  | { t: "stop" }
  | { t: "pause" }
  | { t: "press" }
  | { t: "end" }
  | { t: "review" }
);

const BEATS: Beat[] = [
  { t: "say", i: 5 },
  { t: "note", v: "timeline", force: true },
  { t: "event" },
  { t: "say", i: 6 },
  { t: "event" },
  { t: "say", i: 7 },
  { t: "ask", i: 2 },
  { t: "stop" },
  { t: "pause" },
  { t: "press" },
  { t: "end" },
  { t: "note", v: "summary", ms: 1700, force: true },
  ...Array.from({ length: REVIEW_PARTS }, (): Beat => ({ t: "review" })),
];

export const LAST = BEATS.length;

const SAY_MS = { ko: 26, en: 14 } as const;
const HOLD: Record<Beat["t"], number> = {
  say: 560,
  event: 700,
  note: 780,
  ask: 1500,
  stop: 1400,
  pause: 900,
  press: 1400,
  end: 1300,
  review: 640,
};

const enter = (beat: Beat | undefined) => (beat?.t === "ask" ? THINKING : 0);

export type Demo = {
  lines: Line[];
  live: { line: Line; text: string } | null;
  entries: number;
  review: number;
  status: Status;
  stopping: boolean;
  pressing: boolean;
  noteTab: NoteTab;
  setNoteTab: (v: NoteTab) => void;
  turns: Turn[];
  typing: number | null;
  typingAt: number;
  ask: (item: Ask) => void;
  paused: boolean;
  togglePaused: () => void;
};

export function useInView() {
  const [visible, setVisible] = useState(false);
  const [seen, setSeen] = useState(false);

  const attach = useCallback((el: HTMLElement | null) => {
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const now = entries[0]?.isIntersecting ?? false;
        setVisible(now);
        if (now) setSeen(true);
      },
      { rootMargin: "-64px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return [visible, seen, attach] as const;
}

export function useDemo({
  visible,
  seen,
}: {
  visible: boolean;
  seen: boolean;
}): Demo {
  const [raw, setCursor] = useState(0);
  const [progress, setProgress] = useState(0);
  const [noteOverride, setNoteOverride] = useState<NoteTab | null>(null);
  const [extra, setExtra] = useState<
    Array<{ item: Ask; at: number; id: number }>
  >([]);
  const [manualTyping, setManualTyping] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const { transcript, seed, asks } = useDemoCopy();
  const sayMs = SAY_MS[useLocale()];

  const skip = seen && prefersReducedMotion();
  const cursor = skip ? LAST : raw;
  const done = cursor >= LAST;
  const playing = visible && !skip && !done && !paused;

  const manualBusy = manualTyping !== null;

  const view = useMemo(() => {
    const now = BEATS[cursor];
    const flowing = now?.t === "say" || now?.t === "ask";
    const settled = BEATS.slice(0, cursor);
    const seen = flowing ? settled : BEATS.slice(0, cursor + 1);

    const said = settled.filter((b) => b.t === "say").length;
    return {
      lines: transcript.slice(0, BASE_LINES + said),
      live:
        now?.t === "say"
          ? {
              line: transcript[now.i],
              text: transcript[now.i].text.slice(0, progress),
            }
          : null,
      entries: BASE_ENTRIES + seen.filter((b) => b.t === "event").length,
      review: seen.filter((b) => b.t === "review").length,
      status: (seen.some((b) => b.t === "end")
        ? "ended"
        : seen.some((b) => b.t === "pause")
          ? "paused"
          : "recording") as Status,
      stopping: now?.t === "stop",
      pressing: now?.t === "press",
      noteTab: seen.reduce<NoteTab>(
        (v, b) => (b.t === "note" ? b.v : v),
        "script"
      ),
      scriptTurns: settled
        .filter((b): b is { t: "ask"; i: number } => b.t === "ask")
        .map((b) => asks[b.i]),
      scriptAsk: now?.t === "ask" ? asks[now.i] : null,
    };
  }, [cursor, progress, transcript, asks]);

  useEffect(() => {
    if (!visible || skip || !done || manualBusy || paused) return;
    const id = window.setTimeout(() => {
      setCursor(0);
      setProgress(0);
      setNoteOverride(null);
      setExtra([]);
      setManualTyping(null);
    }, LOOP_GAP);
    return () => window.clearTimeout(id);
  }, [visible, skip, done, manualBusy, paused]);

  const here = BEATS[cursor];
  const repeated =
    here?.t === "ask" && extra.some((e) => e.item.q === asks[here.i].q);

  useEffect(() => {
    if (!playing) return;
    const beat = BEATS[cursor];
    if (!beat) return;
    if (beat.t === "ask" && manualBusy) return;

    const step = (ms: number, run: () => void) => {
      const id = window.setTimeout(run, ms);
      return () => window.clearTimeout(id);
    };
    const next = () =>
      setCursor((c) => {
        const upcoming = BEATS[c + 1];
        if (upcoming?.force) setNoteOverride(null);
        setProgress(enter(upcoming));
        return c + 1;
      });

    if (beat.t === "say") {
      const full = transcript[beat.i].text;
      return progress < full.length
        ? step(sayMs, () => setProgress((n) => n + 1))
        : step(HOLD.say, next);
    }
    if (beat.t === "ask") {
      if (repeated) return step(0, next);
      const full = asks[beat.i].a;
      if (progress === THINKING) return step(THINK_MS, () => setProgress(0));
      return progress < full.length
        ? step(16, () => setProgress((n) => Math.min(n + 2, full.length)))
        : step(HOLD.ask, next);
    }
    return step(beat.ms ?? HOLD[beat.t], next);
  }, [playing, cursor, progress, manualBusy, repeated, transcript, asks, sayMs]);

  const scriptAsk = manualBusy || repeated ? null : view.scriptAsk;
  const shownAsks = view.scriptTurns.length + (scriptAsk ? 1 : 0);

  const ask = useCallback(
    (item: Ask) => {
      if (manualTyping !== null) return;
      setExtra((list) => [
        ...list,
        { item, at: shownAsks, id: list.length },
      ]);
      setManualTyping(prefersReducedMotion() ? null : THINKING);
    },
    [manualTyping, shownAsks]
  );

  useEffect(() => {
    if (manualTyping === null) return;
    const full = extra[extra.length - 1]?.item.a ?? "";
    if (manualTyping === THINKING) {
      const id = window.setTimeout(() => setManualTyping(0), THINK_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(
      () =>
        setManualTyping((n) =>
          n === null || n + 2 >= full.length ? null : n + 2
        ),
      16
    );
    return () => window.clearTimeout(id);
  }, [extra, manualTyping]);

  const script = [...view.scriptTurns, ...(scriptAsk ? [scriptAsk] : [])];
  const visitor = (e: (typeof extra)[number]): Turn => ({
    ...e.item,
    key: `visitor-${e.id}`,
    mine: true,
  });
  const turns: Turn[] = [{ ...seed, key: "seed", mine: false }];
  script.forEach((item, i) => {
    for (const e of extra) if (e.at === i) turns.push(visitor(e));
    if (extra.some((e) => e.at <= i && e.item.q === item.q)) return;
    turns.push({ ...item, key: `script-${i}`, mine: false });
  });
  for (const e of extra) if (e.at >= script.length) turns.push(visitor(e));

  const streaming =
    manualTyping !== null
      ? `visitor-${extra.length - 1}`
      : scriptAsk
        ? `script-${script.length - 1}`
        : null;

  return {
    lines: view.lines,
    live: view.live,
    entries: view.entries,
    review: view.review,
    status: view.status,
    stopping: view.stopping,
    pressing: view.pressing,
    noteTab: noteOverride ?? view.noteTab,
    setNoteTab: setNoteOverride,
    turns,
    typing:
      manualTyping !== null ? manualTyping : scriptAsk ? progress : null,
    typingAt:
      streaming === null ? -1 : turns.findIndex((t) => t.key === streaming),
    ask,
    paused,
    togglePaused: () => setPaused((p) => !p),
  };
}
