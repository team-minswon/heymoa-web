"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type DependencyList,
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleStop,
  Copy,
  LoaderCircle,
  Mic,
  MoreHorizontal,
  Pause,
  SkipForward,
  UserPlus,
  Users,
} from "lucide-react";
import { useMessages, useTranslations } from "next-intl";

import {
  BASE_ENTRIES,
  BASE_LINES,
  FILTER_OF,
  FILTERS,
  LENGTH,
  NOTE_TABS,
  SPEAKER_LABEL,
  useDemoCopy,
  type Demo,
  type Entry,
  type Filter,
  type Line,
  type NoteTab,
} from "@/components/heymoa/landing/use-demo";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import { LiveChip, TIMELINE_ROW_GRID } from "@/components/notes/timeline-visual";
import type { TimelineTone } from "@/lib/notes/proposals/timeline";
import { cn } from "@/lib/utils";

import {
  ConfirmBar,
  DecisionRow,
  EvidenceQuotes,
  Face,
  FacePile,
  FacesChip,
  HeadChip,
  ReviewHead,
  SectionHead,
  SpeakerFace,
  StatusChip,
  TaskRow,
  TimelineRow,
  type Person,
  usePersonName,
} from "./app";
import { useDoc, type Scene } from "./hero-data";
import { Cursor, Scribble, Sticky } from "./marks";
import { APP, FOCUS, ROLE_COLOR, vars } from "./tokens";

function topIn(node: HTMLElement, box: HTMLElement) {
  let y = 0;
  let at: Element | null = node;
  while (at instanceof HTMLElement && at !== box) {
    y += at.offsetTop;
    at = at.offsetParent;
  }
  return y;
}

/**
 * 줄이 빠져 내용이 짧아지면 브라우저가 스크롤을 끝으로 끌어올립니다. 그 스크롤 이벤트를 「사람이 올렸다」로 읽으면
 * 따라가기가 풀리므로 끝에 붙어 있으면 따라가는 중으로 칩니다. `scrollTop` 만 씁니다 — 숨은 쪽이 페이지를 끌고 가지 않게.
 */
function useSnapFollow(deps: DependencyList) {
  const ref = useRef<HTMLDivElement>(null);
  const placed = useRef(0);
  const following = useRef(true);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    following.current =
      el.scrollTop >= placed.current - 24 || el.scrollTop >= el.scrollHeight - el.clientHeight - 2;
  };

  useEffect(() => {
    const el = ref.current;
    if (!el || !following.current) return;
    const style = getComputedStyle(el);
    const max = el.scrollHeight - el.clientHeight;
    const end = el.scrollHeight - (parseFloat(style.paddingBottom) || 0);
    const want = end + (parseFloat(style.getPropertyValue("--reserve")) || 0) - el.clientHeight;
    let top = 0;
    let cut = false;
    if (max > 0 && want > 0) {
      const head = el.querySelector<HTMLElement>("[data-snap-head]");
      const gap = head ? head.offsetHeight : 12;
      const slack = head ? SNAP_SLACK : Infinity;
      top = Math.min(want, max);
      cut = head !== null;
      for (const node of el.querySelectorAll<HTMLElement>("[data-snap], ol > li")) {
        if (!node.offsetParent) continue;
        const at = topIn(node, el) - gap;
        if (at < want) continue;
        if (at <= max && at - want <= slack) {
          top = at;
          cut = false;
        }
        break;
      }
    }
    placed.current = top;
    el.scrollTop = top;
    el.toggleAttribute("data-cut", cut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return [ref, onScroll] as const;
}

const FOLLOW_BOX = "pb-52 [--reserve:60px] lg:[--reserve:76px]";

const SNAP_SLACK = 32;

/**
 * 탭 본문의 스크롤 상자가 곧 tabpanel 이다. 키보드로 굴릴 수 있게 탭 순서에 들고(Chrome 이 이름 없는
 * 상자로 저절로 끼우던 자리), 이름은 고른 탭이 준다. 링은 상자 안쪽에 그린다(창이 바깥을 자른다).
 */
type PanelProps = {
  role: "tabpanel";
  id: string;
  "aria-labelledby": string;
  tabIndex: number;
};
const PANEL_FOCUS = cn(FOCUS, "focus-visible:outline-offset-[-3px]");

function useTabKeys(value: NoteTab, onChange: (t: NoteTab) => void) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    const last = NOTE_TABS.length - 1;
    const els = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
    const focused = els.indexOf(event.target as HTMLElement);
    const at = focused >= 0 ? focused : NOTE_TABS.indexOf(value);
    const next =
      event.key === "ArrowRight"
        ? at >= last
          ? 0
          : at + 1
        : event.key === "ArrowLeft"
          ? at <= 0
            ? last
            : at - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(NOTE_TABS[next]);
    els[next]?.focus();
  };
}

function NoteTabs({
  value,
  onChange,
  uid,
  pointer,
}: {
  value: NoteTab;
  onChange: (t: NoteTab) => void;
  uid: string;
  pointer: { tab: NoteTab; press: boolean } | null;
}) {
  const t = useTranslations("landing");
  return (
    <div
      role="tablist"
      aria-label={t("demo.topBar.tablist")}
      onKeyDown={useTabKeys(value, onChange)}
      className="order-last -mb-px flex h-10 w-full items-stretch gap-4 lg:order-none lg:h-14 lg:w-auto lg:gap-5"
    >
      {NOTE_TABS.map((tab, i) => {
        const on = tab === value;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`${uid}-tab-${i}`}
            aria-controls={`${uid}-panel`}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(tab)}
            className={cn(
              "relative flex cursor-pointer items-center px-0.5 text-[13px] font-medium whitespace-nowrap transition-colors before:absolute before:-inset-x-2 before:inset-y-0",
              on ? APP.ink : "text-[var(--el-ink)]/60 hover:text-[var(--el-ink)]",
              FOCUS,
              "focus-visible:outline-offset-[-3px]"
            )}
          >
            {t(`app.tabs.${tab}`)}
            {on ? (
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--el-ink)]" />
            ) : null}
            {pointer?.tab === tab ? (
              <Cursor press={pointer.press} delay={-450} className="top-[95%] left-[58%]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function TopBar({
  demo,
  scene,
  uid,
  pointer,
}: {
  demo: Demo;
  scene: Scene;
  uid: string;
  pointer: { tab: NoteTab; press: boolean } | null;
}) {
  const { status } = demo;
  const t = useTranslations("landing.demo");
  const recording = status === "recording";
  const gone = status === "ended";
  const pointing = scene === "paused" || scene === "press";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 border-b border-[var(--el-hairline)] px-3 max-[359px]:gap-x-1.5 max-[359px]:px-2.5 lg:h-14 lg:flex-nowrap lg:gap-x-3 lg:px-5">
      <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1 lg:h-14 lg:py-0">
        <span className="relative mr-1 flex shrink-0">
          <span key={status} className={cn("-ml-1.5 rounded-full px-1.5 py-1", gone && "tv-ring")}>
            <StatusChip status={status} />
          </span>
          {scene === "paused" ? (
            <Scribble
              kind="circle"
              draw="mount"
              className="absolute -top-1.5 -left-3 h-[calc(100%+12px)] w-[calc(100%+20px)]"
            />
          ) : null}
        </span>
        <span
          className={cn(
            "min-w-0 text-[13px] leading-[1.35] font-semibold max-[359px]:truncate lg:truncate lg:text-[13.5px]",
            APP.ink
          )}
        >
          {t("title")}
        </span>
      </div>

      <NoteTabs value={demo.noteTab} onChange={demo.setNoteTab} uid={uid} pointer={pointer} />

      <span
        aria-hidden
        data-gone={gone ? "" : undefined}
        className="relative flex shrink-0 data-[gone]:-ml-2 motion-safe:[transition:margin_.45s_cubic-bezier(.65,0,.35,1)] motion-safe:data-[gone]:[transition:margin_.45s_cubic-bezier(.65,0,.35,1)_.12s] lg:data-[gone]:-ml-3"
      >
        <span
          data-gone={gone ? "" : undefined}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 overflow-hidden rounded-[8px] border border-[var(--el-error)] bg-white px-2 text-[12px] font-medium whitespace-nowrap lg:h-8 lg:px-2.5",
            "[max-inline-size:8rem] data-[gone]:border-transparent data-[gone]:px-0 data-[gone]:opacity-0 data-[gone]:[max-inline-size:0]",
            "motion-safe:[transition:max-inline-size_.45s_cubic-bezier(.65,0,.35,1),padding_.45s_cubic-bezier(.65,0,.35,1),opacity_.15s_ease-out_.4s,border-color_.15s_ease-out_.4s]",
            "motion-safe:data-[gone]:[transition:opacity_.12s_ease-out,border-color_.12s_ease-out,max-inline-size_.45s_cubic-bezier(.65,0,.35,1)_.12s,padding_.45s_cubic-bezier(.65,0,.35,1)_.12s]",
            APP.rec,
            recording && "border-[var(--el-error)]/35",
            demo.pressing && "tv-press"
          )}
        >
          <CircleStop
            aria-hidden
            className={cn("size-3.5 shrink-0 lg:size-4", recording && "opacity-45")}
          />
          {t("topBar.endMeeting")}
        </span>
        {pointing ? <Cursor press={scene === "press"} className="top-[84%] left-[58%]" /> : null}
      </span>

      {recording ? null : (
        <span
          aria-hidden
          className={cn(
            "tv-pop inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] border max-[359px]:hidden lg:size-8",
            APP.line,
            APP.muted
          )}
        >
          <MoreHorizontal className="size-4" />
        </span>
      )}
    </div>
  );
}

function Dock({ demo, scene, holding }: { demo: Demo; scene: Scene; holding: boolean }) {
  const gone = demo.status === "ended";
  const at = demo.live?.line.at ?? demo.lines[demo.lines.length - 1].at;
  const pointing = scene === "stop";
  const pressing = demo.stopping && !holding;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center lg:bottom-4"
    >
      <span
        data-gone={gone ? "" : undefined}
        className={cn(
          "tv-dock flex h-10 items-center rounded-full border bg-white/95 p-1 shadow-e2 data-[gone]:translate-y-2 data-[gone]:opacity-0 lg:h-11",
          APP.line
        )}
      >
        <span className={cn("flex size-8 items-center justify-center lg:size-9", APP.muted)}>
          <Mic className="size-4" />
        </span>
        <span className="mx-1 h-5 w-px bg-[var(--el-hairline)]" />
        {demo.status === "recording" ? (
          <span className="flex items-center gap-2 pr-1 pl-2">
            <span className="min-w-12 font-mono text-[13px] font-semibold text-[var(--el-error)] tabular-nums">
              {at}
            </span>
            <span className="mx-0.5 flex h-5 w-8 items-center justify-center gap-[3px]">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  style={vars({ "--i": i })}
                  className="tv-level h-4 w-[3px] rounded-full bg-[var(--el-error)]"
                />
              ))}
            </span>
            <span
              className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-full lg:size-9",
                APP.faint,
                pressing && "tv-press"
              )}
            >
              <Pause className="size-3.5" />
              {pointing ? <Cursor press={pressing} className="top-[70%] left-[68%]" /> : null}
            </span>
          </span>
        ) : (
          <span className="flex shrink-0 items-center px-1">
            <span className="flex size-8 items-center justify-center rounded-full bg-[var(--el-error)] shadow-sm lg:size-9">
              <span className="size-2.5 rounded-full bg-white" />
            </span>
          </span>
        )}
      </span>
    </div>
  );
}

const PEOPLE: Person[] = ["minseo", "jihoon", "seoyeon", "woojae"];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={cn("text-[12px] font-semibold", APP.ink)}>{label}</span>
      {children}
    </div>
  );
}

function DetailsPanel({ ended, at, panel }: { ended: boolean; at: string; panel: PanelProps }) {
  const t = useTranslations("landing.demo");
  const name = usePersonName();
  const facts: Array<[string, ReactNode]> = [
    [
      t("details.host"),
      <>
        <Face who="minseo" size={22} />
        <span className="ml-1">
          {name("minseo")}
          <span className={cn("font-normal", APP.muted)}>{` · ${t("details.hostRole")}`}</span>
        </span>
      </>,
    ],
    [
      t("details.recorded"),
      <>
        <span className="tabular-nums">{ended ? LENGTH : at}</span>
      </>,
    ],
    [t("details.sharing"), t("details.sharingValue")],
    [t("details.created"), t("details.createdValue")],
    [t("details.updated"), t("details.updatedValue")],
  ];
  return (
    <div {...panel} className={cn("h-full overflow-y-auto px-4 pt-5 pb-20 lg:px-8 lg:pt-6", PANEL_FOCUS)}>
      <div className="flex flex-col gap-4">
        <Field label={t("details.titleLabel")}>
          <span
            className={cn(
              "flex h-9 items-center rounded-[8px] border border-[var(--el-hairline-strong)] px-2.5 text-[14px]",
              APP.ink
            )}
          >
            {t("title")}
          </span>
        </Field>
        <Field label={t("details.attendees")}>
          <span className="flex flex-wrap items-center gap-2.5">
            <FacePile names={PEOPLE} size={28} />
            <span
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
                APP.line,
                APP.softBg,
                APP.ink
              )}
            >
              <UserPlus aria-hidden className="size-4" />
              {t("details.pickAttendees")}
            </span>
          </span>
        </Field>
        <span
          className={cn(
            "inline-flex h-8 w-fit items-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-medium",
            APP.primary
          )}
        >
          <Check aria-hidden className="size-4" />
          {t("details.save")}
        </span>
      </div>
      <section className="mt-6 flex flex-col">
        <p className={cn("m-0 mb-2.5 text-[13px] font-semibold", APP.ink)}>{t("details.meetingInfo")}</p>
        <dl className="m-0 flex flex-col">
          {facts.map(([k, v], i) => (
            <Fragment key={k}>
              {i === 3 ? (
                <span aria-hidden className="my-2.5 block h-px w-full bg-[var(--el-hairline)]" />
              ) : null}
              <div className="flex min-h-[30px] items-center gap-3">
                <dt className={cn("w-[100px] shrink-0 text-[12px] lg:w-[124px]", APP.body)}>{k}</dt>
                <dd
                  className={cn(
                    "m-0 flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] font-medium",
                    APP.ink
                  )}
                >
                  {v}
                </dd>
              </div>
            </Fragment>
          ))}
        </dl>
      </section>
    </div>
  );
}

function splitLive(text: string) {
  const cut = Math.max(0, text.length - 6);
  return [text.slice(0, cut), text.slice(cut)] as const;
}

const CARET = (
  <span
    aria-hidden
    className="tv-caret ml-1 inline-block h-4 w-px bg-[var(--el-muted)] align-middle"
  />
);

function ScriptPanel({ demo, panel, rise }: { demo: Demo; panel: PanelProps; rise: boolean }) {
  const t = useTranslations("landing");
  const { lines, live } = demo;
  const ended = demo.status === "ended";
  const rows = [
    ...lines.map((line) => ({ line, typed: undefined as string | undefined })),
    ...(live ? [{ line: live.line, typed: live.text }] : []),
  ];
  const [ref, onScroll] = useSnapFollow([rows.length, live?.text]);
  const unassigned = new Set(rows.map((row) => row.line.who)).size;
  const tool = "inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] font-medium";

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      {...panel}
      className={cn("group/script relative h-full overflow-y-auto px-4 lg:px-8", FOLLOW_BOX, PANEL_FOCUS)}
    >
      <div
        aria-hidden
        data-snap-head
        className={cn(
          "sticky top-0 z-10 -mx-4 flex items-center justify-end gap-1 bg-white px-4 pt-3 pb-2 lg:-mx-8 lg:px-8 lg:pt-4",
          APP.body
        )}
      >
        <span className="pointer-events-none absolute inset-x-0 top-full h-4 bg-gradient-to-b from-white to-transparent group-data-[cut]/script:h-9" />
        {ended ? (
          <>
            <span className={tool}>
              <Users className={cn("size-3.5", APP.muted)} />
              {t("demo.script.speakers")}
            </span>
            <span className={tool}>
              <SkipForward className={cn("size-3.5", APP.muted)} />
              {t("demo.script.unassigned", { count: unassigned })}
            </span>
          </>
        ) : null}
        <span className={cn(tool, "border", APP.line)}>
          <Copy className={cn("size-3.5", APP.muted)} />
          {t("demo.script.copy")}
        </span>
      </div>
      <ul className="m-0 mt-1 list-none p-0">
        {rows.map(({ line, typed }, i) => {
          const label = SPEAKER_LABEL[line.who] ?? "";
          const [firm, soft] = splitLive(typed ?? "");
          const base = rise && i < BASE_LINES;
          const liveLabel = (
            <>
              <span aria-hidden className="tv-blink size-1.5 shrink-0 rounded-full bg-[#ef4444]" />
              {t("app.transcribing")}
            </>
          );
          return (
            <li
              key={line.at}
              data-snap
              data-mark={typed === undefined ? undefined : ""}
              style={base ? vars({ "--i": i + 3 }) : undefined}
              className={cn(
                "grid grid-cols-[40px_minmax(0,1fr)] gap-3 py-3.5 lg:grid-cols-[72px_minmax(0,1fr)] lg:gap-5",
                typed === undefined
                  ? "border-b border-[var(--el-hairline)]"
                  : cn("-mx-4 rounded-[6px] px-4", APP.softBg, typed === "" && "invisible"),
                base && "tv-rise"
              )}
            >
              {typed === undefined ? (
                <span className={cn("pt-1 font-mono text-[11px] tabular-nums", APP.muted)}>
                  {line.at}
                </span>
              ) : (
                <span
                  className={cn(
                    "hidden items-center gap-1.5 self-start pt-1 text-[11px] whitespace-nowrap lg:flex",
                    APP.muted
                  )}
                >
                  {liveLabel}
                </span>
              )}
              <div className={cn("min-w-0", typed !== undefined && "max-lg:col-start-2")}>
                {typed === undefined ? null : (
                  <span
                    className={cn(
                      "mb-0.5 flex items-center gap-1.5 text-[11px] lg:hidden",
                      APP.muted
                    )}
                  >
                    {liveLabel}
                  </span>
                )}
                {ended ? (
                  <span
                    style={vars({ "--i": i })}
                    className={cn(
                      "tv-rise mb-1 inline-flex items-center gap-1.5 text-[12.5px] font-medium",
                      APP.muted
                    )}
                  >
                    <SpeakerFace label={label} size={18} />
                    {t("app.speaker", { label })}
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--el-muted-soft)]" />
                  </span>
                ) : null}
                <p
                  aria-hidden={typed === undefined ? undefined : true}
                  className={cn(
                    "m-0 text-[15px] leading-7 tracking-[0.005em]",
                    typed === undefined ? APP.ink : APP.body
                  )}
                >
                  {typed === undefined ? (
                    line.text
                  ) : (
                    <>
                      <span className={APP.ink}>{firm}</span>
                      {soft}
                      {CARET}
                    </>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const inFilter = (tone: TimelineTone, filter: Filter) =>
  filter === "all" || FILTER_OF[tone] === filter;

const FLASH =
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[8px] before:mix-blend-multiply motion-safe:before:[animation:tv-flash_1.6s_ease-out_both]";

const baseCount = (timeline: Entry[]) =>
  Object.fromEntries(
    FILTERS.map((f) => [
      f,
      timeline.slice(0, BASE_ENTRIES).filter((e) => e.tone && inFilter(e.tone, f)).length,
    ])
  ) as Record<Filter, number>;

function AgendaButton({
  range,
  title,
  total,
  bump,
  open,
  live,
  listId,
  onToggle,
}: {
  range: ReactNode;
  title: string;
  total: number;
  bump: boolean;
  open: boolean;
  live: boolean;
  listId: string;
  onToggle: () => void;
}) {
  const t = useTranslations("landing.app");
  return (
    <div data-snap>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
        className={cn(
          "-mx-2 flex min-h-[30px] w-[calc(100%+16px)] cursor-pointer items-center gap-0.5 rounded-[7px] py-0.5 text-left transition-colors hover:bg-[var(--el-canvas-soft)]",
          FOCUS,
          "focus-visible:outline-offset-0"
        )}
      >
        <span className={cn("shrink-0 self-start px-2 pt-[3px] text-[12px] tabular-nums", APP.muted)}>
          {range}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2.5 pr-2 pl-1">
          <span className={cn("min-w-0 truncate text-[15px] leading-[22px] font-semibold", APP.ink)}>
            {title}
          </span>
          <span
            key={total}
            className={cn(
              "-ml-1 shrink-0 text-[12.5px] tabular-nums",
              APP.muted,
              bump && "tv-bump [animation-delay:300ms]!"
            )}
          >
            {total}
          </span>
          <ChevronRight
            aria-hidden
            className={cn("-ml-1.5 size-3.5 shrink-0", APP.faint, open && "rotate-90")}
          />
          <span className="flex-1" />
          {live ? <LiveChip dotClassName="tv-blink" label={t("live")} /> : null}
        </span>
      </button>
    </div>
  );
}

function TimelinePanel({ demo, uid, panel }: { demo: Demo; uid: string; panel: PanelProps }) {
  const { entries, live, status } = demo;
  const t = useTranslations("landing.demo");
  const { title, project, timeline } = useDemoCopy();
  const base = baseCount(timeline);
  const recording = status === "recording";
  const [folded, setFolded] = useState<ReadonlySet<number>>(() => new Set());
  const toggle = (index: number) =>
    setFolded((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  const shown = timeline.slice(0, entries);
  const count = (f: Filter) =>
    shown.filter((e) => e.tone && inFilter(e.tone, f)).length;

  type Group = {
    index: number;
    agenda: Entry;
    end: string | null;
    total: number;
    items: Array<{ index: number; entry: Entry & { tone: TimelineTone } }>;
  };
  const groups: Group[] = [];
  shown.forEach((entry, index) => {
    const current = groups[groups.length - 1];
    if (!entry.tone) {
      if (current) current.end = entry.at;
      groups.push({ index, agenda: entry, end: null, total: 0, items: [] });
      return;
    }
    current.total += 1;
    current.items.push({ index, entry: { ...entry, tone: entry.tone } });
  });
  const last = groups[groups.length - 1];
  const fresh = recording && entries > BASE_ENTRIES && !live?.text;

  const [ref, onScroll] = useSnapFollow([entries, live?.text, folded]);
  const [firm, soft] = splitLive(live?.text ?? "");

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      {...panel}
      className={cn(
        "relative h-full overflow-y-auto px-4 pt-4 [mask-image:linear-gradient(to_bottom,transparent,#000_20px)] lg:px-8 lg:pt-6",
        FOLLOW_BOX,
        PANEL_FOCUS
      )}
    >
      <header data-snap className="hidden lg:block">
        <p
          className={cn(
            "m-0 text-[28px] leading-[38px] font-medium tracking-[-0.4px]",
            APP.ink
          )}
        >
          {title}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <HeadChip icon="calendar">{t("timelinePanel.date")}</HeadChip>
          <HeadChip icon="people">{t("timelinePanel.people", { count: PEOPLE.length })}</HeadChip>
          <HeadChip icon="project">{project}</HeadChip>
        </div>
      </header>

      <div
        data-snap
        className={cn(
          "flex flex-col gap-1.5 border-b pb-2.5 lg:mt-6 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-4",
          APP.lineSoft
        )}
      >
        <span aria-hidden className="flex flex-wrap items-center gap-0.5">
          {FILTERS.map((f) => {
            const n = count(f);
            return (
              <span
                key={f}
                className={cn(
                  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2 text-[13px] sm:px-[9px]",
                  f === "all" ? cn(APP.chipBg, "font-medium", APP.ink) : APP.muted
                )}
              >
                {t(`filters.${f}`)}
                <span
                  key={n}
                  className={cn(
                    "text-[12px] font-normal tabular-nums",
                    f === "all" ? APP.body : APP.muted,
                    n !== base[f] && "tv-bump [animation-delay:300ms]!"
                  )}
                >
                  {n}
                </span>
              </span>
            );
          })}
        </span>
        <span className="sr-only">{t("timelinePanel.srTotal", { count: count("all") })}</span>
        <span className={cn("text-[12px]", APP.muted)}>
          {status === "ended" ? t("timelinePanel.endedNote") : t("timelinePanel.liveNote")}
        </span>
      </div>

      {groups.map((group) => {
        const isFolded = folded.has(group.index);
        const listId = `${uid}-agenda-${group.index}`;
        const live = group === last && recording;
        const range = group.end ? (
          `${group.agenda.at} – ${group.end}`
        ) : live ? (
          <>
            {group.agenda.at}
            <span className="max-sm:hidden"> – {t("timelinePanel.now")}</span>
          </>
        ) : (
          group.agenda.at
        );
        return (
          <section key={group.index} className="mt-5">
            <AgendaButton
              range={range}
              title={group.agenda.title}
              total={group.total}
              bump={group.items.some((item) => item.index >= BASE_ENTRIES)}
              open={!isFolded}
              live={live}
              listId={listId}
              onToggle={() => toggle(group.index)}
            />
            <ol
              id={listId}
              hidden={isFolded}
              data-mark={fresh && group === last ? "" : undefined}
              className="relative m-0 mt-1.5 list-none p-0 [--i:0]"
            >
              <span
                aria-hidden
                className="absolute top-4 bottom-4 left-[63px] w-px bg-[var(--el-hairline)]"
              />
              {group.items.map(({ index, entry }) => (
                <TimelineRow
                  key={index}
                  at={entry.at}
                  tone={entry.tone}
                  kind={entry.kind === "agenda" ? "" : t(`kinds.${entry.kind}`)}
                  title={entry.title}
                  meta={metaOf(entry, timeline, t)}
                  className={
                    index < BASE_ENTRIES
                      ? undefined
                      : cn("tv-rise [animation-duration:300ms]!", recording && FLASH)
                  }
                />
              ))}
            </ol>
          </section>
        );
      })}

      {live && recording ? (
        <div
          aria-hidden
          className={cn(
            TIMELINE_ROW_GRID,
            "mt-4 border-t border-dashed border-[var(--el-hairline)] pt-4",
            !live.text && "invisible"
          )}
        >
          <span />
          <span className="flex justify-center pt-[9px]">
            <span className="tv-blink size-1.5 rounded-full bg-[#ef4444]" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className={cn("text-[15px] leading-6", APP.muted)}>
              <span className={APP.body}>{firm}</span>
              {soft}
              {CARET}
            </span>
            <span className={cn("text-[12.5px] leading-[19px]", APP.muted)}>{t("transcribing")}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function metaOf(
  entry: Entry,
  timeline: Entry[],
  t: ReturnType<typeof useTranslations<"landing.demo">>
) {
  if (entry.meta === "waiting") return t("meta.waiting");
  if (entry.meta === "answered") {
    return t("meta.answered", { at: timeline[entry.answer ?? 0]?.at ?? entry.at });
  }
  return undefined;
}

function Analyzing({ panel }: { panel: PanelProps }) {
  const t = useTranslations("landing.demo");
  const steps = useMessages().landing.demo.analyzing.steps;
  return (
    <div {...panel} className={cn("relative h-full px-4 pt-6 lg:px-10 lg:pt-9", PANEL_FOCUS)}>
      <ol
        aria-label={t("analyzing.label")}
        className="m-0 flex list-none flex-wrap items-center gap-2.5 p-0 text-[12px] lg:text-[13px]"
      >
        {steps.map((label, at) => {
          const done = at === 0;
          const now = at === 1;
          return (
            <li
              key={label}
              aria-label={t("analyzing.step", {
                label,
                state: t(
                  done
                    ? "analyzing.states.done"
                    : now
                      ? "analyzing.states.now"
                      : "analyzing.states.waiting"
                ),
              })}
              className="flex items-center gap-2.5"
            >
              {at > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "hidden h-px w-7 sm:block",
                    at <= 1 ? "bg-[var(--el-hairline-strong)]" : "bg-[var(--el-hairline)]"
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap",
                  done && APP.body,
                  now && cn("font-semibold", APP.ink),
                  !done && !now && APP.muted
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                    done
                      ? "border-[var(--el-ink)] bg-[var(--el-ink)] text-white"
                      : "border-[var(--el-hairline-strong)]",
                    now && APP.ink,
                    !done && !now && APP.muted
                  )}
                >
                  {done ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : now ? (
                    <LoaderCircle className="size-3 animate-spin" />
                  ) : (
                    at + 1
                  )}
                </span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-8 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3.5 gap-y-1.5 lg:mt-10">
        <span
          aria-hidden
          className="mt-[3px] block size-[18px] shrink-0 animate-spin rounded-full border-2 border-[var(--el-hairline-strong)] border-t-[var(--el-ink)]"
        />
        <span className={cn("text-[15.5px] font-medium lg:text-[17px]", APP.ink)}>
          {t("analyzing.title")}
        </span>
        <p className={cn("col-start-2 m-0 max-w-[54ch] text-[13.5px] leading-[22px] lg:text-[14px] lg:leading-[23px]", APP.muted)}>
          {t("analyzing.body")}
        </p>
      </div>
      <span aria-hidden className="absolute inset-x-0 top-[74%] flex justify-center lg:top-[60%]">
        <Sticky
          tone="pop"
          tilt={-3}
          anim="pop"
          delay={250}
          className="inline-flex items-center"
        >
          <Scribble kind="chevrons" color="ink" draw="mount" className="h-5 w-12" />
        </Sticky>
      </span>
    </div>
  );
}

const seconds = (at: string) => {
  const [m, s] = at.split(":").map(Number);
  return m * 60 + s;
};
const onTrack = (at: string) => `${((seconds(at) / seconds(LENGTH)) * 100).toFixed(2)}%`;

function MeetingMap() {
  const t = useTranslations("landing.demo");
  const DOC = useDoc();
  const marks = [
    ...DOC.decisions.map((d) => ({ at: d.at, color: ROLE_COLOR.decision })),
    ...DOC.tasks.map((task) => ({ at: task.at, color: ROLE_COLOR.task })),
  ];
  return (
    <div
      aria-hidden
      className="mt-6 border-y border-[var(--el-hairline-soft)] pt-3.5 pb-2.5 lg:rounded-[12px] lg:border-x lg:px-4"
    >
      <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12px]", APP.muted)}>
        <span className={cn("font-medium", APP.body)}>{t("map.title")}</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-[5px]">
            <span className="h-1.5 w-3 rounded-[2px] bg-[var(--el-hairline)]" />
            {t("map.topics")}
          </span>
          <span className="inline-flex items-center gap-[5px] tabular-nums">
            <span className="h-2.5 w-[3px] rounded-[2px]" style={{ background: ROLE_COLOR.decision }} />
            {t("map.decisions", { count: DOC.decisions.length })}
          </span>
          <span className="inline-flex items-center gap-[5px] tabular-nums">
            <span className="h-2.5 w-[3px] rounded-[2px]" style={{ background: ROLE_COLOR.task }} />
            {t("map.tasks", { count: DOC.tasks.length })}
          </span>
        </span>
      </div>
      <div className="relative mt-2 h-[26px]">
        {DOC.topics.map((topic, i) => {
          const end = DOC.topics[i + 1]?.at ?? LENGTH;
          return (
            <span
              key={topic.at}
              className="absolute top-2.5 h-1.5 rounded-[2px] bg-[var(--el-hairline)]"
              style={{
                left: onTrack(topic.at),
                width: `calc(${(((seconds(end) - seconds(topic.at)) / seconds(LENGTH)) * 100).toFixed(2)}% - 2px)`,
              }}
            />
          );
        })}
        {marks.map((mark, i) => (
          <span
            key={mark.at}
            className="tv-pop absolute top-1.5 -ml-[1.5px] h-3.5 w-[3px] rounded-[2px]"
            style={{ left: onTrack(mark.at), background: mark.color, ...vars({ "--d": `${200 + i * 90}ms` }) }}
          />
        ))}
      </div>
      <div className={cn("flex h-4 justify-between text-[11px] tabular-nums", APP.muted)}>
        <span>{t("map.start")}</span>
        <span>{t("map.end")}</span>
      </div>
    </div>
  );
}

function ViewSwitch() {
  const t = useTranslations("landing.demo");
  return (
    <span
      aria-hidden
      className={cn("inline-flex h-8 items-center rounded-full p-[3px] text-[12px] font-medium", APP.chipBg)}
    >
      <span className={cn("rounded-full bg-white px-3 py-1 shadow-[0_1px_2px_#0c0a0914]", APP.ink)}>
        {t("viewSwitch.summary")}
      </span>
      <span className={cn("px-3", APP.body)}>{t("viewSwitch.graph")}</span>
    </span>
  );
}

function anchorOf(review: number, wide: boolean, fits: (name: "decisions" | "open") => boolean) {
  if (review >= 4) return wide && fits("open") ? "open" : "tasks";
  if (review === 3) return fits("decisions") ? "decisions" : "open";
  return review === 2 ? "summary" : null;
}

const ROW_PAD = 11;

const Anchor = ({ name }: { name: string }) => <span aria-hidden data-anchor={name} className="block" />;

const quotesOf = (transcript: Line[], cites: readonly number[]) =>
  [...new Set(cites.flatMap((c) => (c > 0 ? [c - 1, c] : [c])))]
    .sort((a, b) => a - b)
    .map((at) => ({
      label: SPEAKER_LABEL[transcript[at].who],
      at: transcript[at].at,
      text: transcript[at].text,
      cited: cites.includes(at),
    }));

function ReviewDoc({ review, panel }: { review: number; panel: PanelProps }) {
  const t = useTranslations("landing.demo");
  const { title, project, transcript } = useDemoCopy();
  const DOC = useDoc();
  const ref = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLSpanElement>(null);
  const placedOnce = useRef(false);
  const confirming = review >= 4;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const place = (smooth: boolean) => {
      if (!live) return;
      const bar = barRef.current;
      const cover = coverRef.current;
      const barTop = el.clientHeight - (bar?.offsetHeight ?? 0);
      const anchor = (name: string) => el.querySelector<HTMLElement>(`[data-anchor="${name}"]`);
      const open = anchor("open")?.closest<HTMLElement>("[data-row]");
      const fits = (name: "decisions" | "open") => {
        const head = anchor(name);
        if (!head || !open) return false;
        const room = bar ? barTop - 6 : el.clientHeight - 8;
        return topIn(open, el) + open.offsetHeight - topIn(head, el) + 12 <= room;
      };
      const name = anchorOf(review, window.matchMedia("(min-width: 1024px)").matches, fits);
      const node = name ? anchor(name) : null;
      const top = Math.max(
        0,
        Math.min(node ? topIn(node, el) - 12 : 0, el.scrollHeight - el.clientHeight)
      );
      el.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
      if (!bar || !cover) return;
      const hidden = [...el.querySelectorAll<HTMLElement>("[data-row]")].find((row) => {
        const y = topIn(row, el) - top;
        const pad = row.dataset.row === "head" ? 0 : ROW_PAD;
        return y > 0 && y + row.offsetHeight - pad > barTop - 6;
      });
      const from = hidden ? topIn(hidden, el) - top : barTop;
      cover.style.top = `${Math.max(Math.min(from - barTop - 14, -16), 48 - barTop)}px`;
    };
    place(placedOnce.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    placedOnce.current = true;
    if (document.fonts?.status === "loading") void document.fonts.ready.then(() => place(false));
    return () => {
      live = false;
    };
  }, [review]);

  return (
    <div
      ref={ref}
      {...panel}
      data-view="24"
      className={cn(
        "relative flex h-full flex-col overflow-y-auto",
        confirming
          ? "[mask-image:linear-gradient(to_bottom,transparent,#000_12px)]"
          : "[mask-image:linear-gradient(to_bottom,transparent,#000_12px,#000_calc(100%-24px),transparent)]",
        PANEL_FOCUS
      )}
    >
      <div className={cn("flex-1 px-4 pt-5 lg:px-10 lg:pt-6", confirming ? "pb-6" : "pb-[360px]")}>
        <div className="chat-rise">
          <ReviewHead
            state="review"
            titleSize="lg"
            title={title}
            aside={<ViewSwitch />}
            chips={
              <>
                <HeadChip icon="date">{t("review.date")}</HeadChip>
                <HeadChip icon="length">{t("review.length")}</HeadChip>
                <FacesChip names={PEOPLE} />
                <HeadChip icon="project">{project}</HeadChip>
              </>
            }
          />
          <MeetingMap />
          <div className="pt-7">
            <Anchor name="summary" />
            <SectionHead title={t("review.summary")} />
            <p className={cn("m-0 mt-1.5 text-[15px] leading-[1.8]", APP.body)}>
              {DOC.summary}
            </p>
          </div>
        </div>

        {review > 1 ? (
          <div className="chat-rise pt-7">
            <SectionHead title={t("review.topics")} count={DOC.topics.length} />
            <ul className="m-0 mt-1.5 list-none border-t border-[var(--el-hairline-soft)] p-0">
              {DOC.topics.map((topic) => (
                <li key={topic.at} className="border-b border-[var(--el-hairline-soft)]">
                  <div className="-mx-2 grid grid-cols-[44px_minmax(0,1fr)_16px] items-start gap-x-3 px-2 py-3 sm:grid-cols-[56px_minmax(0,1fr)_auto_16px]">
                    <span className={cn("text-[12px] leading-6 tabular-nums", APP.muted)}>{topic.at}</span>
                    <span className="flex min-w-0 flex-col">
                      <span className={cn("text-[15px] leading-6 font-medium", APP.ink)}>
                        {topic.title}
                      </span>
                      <span className={cn("text-[13.5px] leading-5", APP.muted)}>{topic.gist}</span>
                    </span>
                    <span
                      className={cn(
                        "col-start-2 row-start-2 mt-1 flex h-6 items-center gap-2.5 text-[12px] whitespace-nowrap tabular-nums sm:col-start-3 sm:row-start-1 sm:mt-0",
                        APP.muted
                      )}
                    >
                      {topic.counts.map(([tone, n]) => (
                        <span key={tone} className="inline-flex items-center gap-1">
                          <TimelineToneIcon tone={tone} />
                          <span className="sr-only">
                            {t(
                              tone === "decision"
                                ? "review.srKind.decision"
                                : tone === "task"
                                  ? "review.srKind.task"
                                  : "review.srKind.open"
                            )}{" "}
                          </span>
                          {n}
                        </span>
                      ))}
                    </span>
                    <ChevronDown
                      aria-hidden
                      className={cn("col-start-3 row-start-1 mt-1 size-4 sm:col-start-4", APP.faint)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {review > 2 ? (
          <div className="chat-rise pt-7">
            <Anchor name="decisions" />
            <SectionHead title={t("review.decisions")} count={DOC.decisions.length} />
            <div className="mt-1.5">
              {DOC.decisions.map((decision, i) => (
                <div key={decision.at} data-row>
                  {i === 1 ? <Anchor name="open" /> : null}
                  <DecisionRow
                    text={decision.text}
                    topic={decision.topic}
                    at={decision.at}
                    open={i === 1}
                  >
                    <div data-mark>
                      <EvidenceQuotes quotes={quotesOf(transcript, decision.cites)} />
                    </div>
                  </DecisionRow>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {review > 2 ? (
          <div className="chat-rise pt-7">
            <Anchor name="tasks" />
            <div data-row="head">
              <SectionHead
                title={t("review.tasks")}
                count={DOC.tasks.length}
                aside={
                  <span className="hidden items-center gap-2 lg:flex">
                    <span className={cn("text-[12px]", APP.muted)}>
                      {t("review.unnamed", { count: DOC.tasks.length })}
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-[26px] items-center rounded-full border border-[var(--el-hairline-strong)] px-2.5 text-[12px] font-medium",
                        APP.ink
                      )}
                    >
                      {t("review.nameSpeakers")}
                    </span>
                  </span>
                }
              />
            </div>
            <div className="mt-1.5">
              {DOC.tasks.map((task) => (
                <div key={task.at} data-row>
                  <TaskRow text={task.text} who={{ label: task.who }} due={task.due} wide />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {confirming ? (
        <div
          ref={barRef}
          className="chat-rise pointer-events-none sticky bottom-0 flex justify-center px-4 pb-3 lg:px-6 lg:pb-4"
        >
          <span
            ref={coverRef}
            data-cover
            aria-hidden
            className="absolute inset-x-0 -top-4 bottom-0 bg-[linear-gradient(to_bottom,transparent,white_14px)]"
          />
          {(["plate", "pill", "float"] as const).map((variant) => (
            <ConfirmBar
              key={variant}
              variant={variant}
              className={
                variant === "plate"
                  ? "min-[360px]:hidden"
                  : variant === "pill"
                    ? "max-[360px]:hidden lg:hidden"
                    : "max-lg:hidden"
              }
              state={{ kind: "ready", decisions: DOC.decisions.length, tasks: DOC.tasks.length }}
              buttonSlot={
                <>
                  <span
                    aria-hidden
                    className="tv-ring absolute inset-0 rounded-[inherit]"
                    style={vars({ "--n": 2 })}
                  />
                  <Cursor className="top-[82%] left-[80%]" delay={300} />
                </>
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SummaryPanel({ demo, panel }: { demo: Demo; panel: PanelProps }) {
  const t = useTranslations("landing.demo");
  if (demo.status !== "ended") {
    return (
      <div {...panel} className={cn("h-full px-4 pt-5 lg:px-8 lg:pt-6", PANEL_FOCUS)}>
        <div className={cn("rounded-[16px] p-5", APP.softBg)}>
          <p className={cn("m-0 text-[14px] font-medium", APP.ink)}>{t("summaryWaiting.title")}</p>
          <p className={cn("m-0 mt-1 text-[12px] leading-relaxed", APP.muted)}>
            {t("summaryWaiting.body")}
          </p>
        </div>
      </div>
    );
  }
  return demo.review === 0 ? (
    <Analyzing panel={panel} />
  ) : (
    <ReviewDoc review={demo.review} panel={panel} />
  );
}

export function HeroNote({
  demo,
  scene,
  holding,
  uid,
}: {
  demo: Demo;
  scene: Scene;
  holding: boolean;
  uid: string;
}) {
  const tab = demo.noteTab;
  const live = demo.live;
  const at = live?.line.at ?? demo.lines[demo.lines.length - 1].at;
  const [firstTab, setFirstTab] = useState<NoteTab | null>(tab);
  if (firstTab !== null && firstTab !== tab) setFirstTab(null);
  const wasInside = useRef(false);
  useEffect(() => {
    if (!wasInside.current) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    wasInside.current = false;
    document.getElementById(`${uid}-tab-${NOTE_TABS.indexOf(tab)}`)?.focus();
  }, [tab, uid]);

  const pointer: { tab: NoteTab; press: boolean } | null =
    scene === "timeline"
      ? { tab: "timeline", press: true }
      : scene === "listen" && live && live.text.length === live.line.text.length
        ? { tab: "timeline", press: false }
        : null;

  const panel: PanelProps = {
    role: "tabpanel",
    id: `${uid}-panel`,
    "aria-labelledby": `${uid}-tab-${NOTE_TABS.indexOf(tab)}`,
    tabIndex: 0,
  };

  return (
    <>
      <TopBar demo={demo} scene={scene} uid={uid} pointer={pointer} />
      <div
        onFocus={() => {
          wasInside.current = true;
        }}
        onBlur={() => {
          wasInside.current = false;
        }}
        className="relative min-h-0 flex-1 overflow-hidden"
      >
        <div key={tab} className="chat-rise h-full">
          {tab === "info" ? (
            <DetailsPanel ended={demo.status === "ended"} at={at} panel={panel} />
          ) : null}
          {tab === "script" ? (
            <ScriptPanel demo={demo} panel={panel} rise={firstTab !== null} />
          ) : null}
          {tab === "timeline" ? <TimelinePanel demo={demo} uid={uid} panel={panel} /> : null}
          {tab === "summary" ? <SummaryPanel demo={demo} panel={panel} /> : null}
        </div>
        <Dock demo={demo} scene={scene} holding={holding} />
      </div>
    </>
  );
}
