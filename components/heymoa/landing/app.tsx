import type { HTMLAttributes, ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowUp,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Folder,
  History,
  PanelRightClose,
  Pause,
  Plus,
  Sparkles,
  Square,
  Users,
} from "lucide-react";

import { FACE_KEY } from "@/components/heymoa/landing/shell";
import type { NoteTab, Status } from "@/components/heymoa/landing/use-demo";
import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import {
  LiveChip,
  TIMELINE_ROW_GRID,
  TONE_TEXT,
  TONE_TITLE,
} from "@/components/notes/timeline-visual";
import { scopeChipClass } from "@/lib/chat/scope-chip";
import type { TimelineTone } from "@/lib/notes/proposals/timeline";
import { unnamedSpeakerAvatarKey } from "@/lib/people/avatar-key";
import { cn } from "@/lib/utils";

import { RICH } from "./rich";
import { APP, RADIUS, SHADOW } from "./tokens";

const FACE = {
  ...FACE_KEY,
  seojin: "landing:tldv:han-seojin",
  taeyun: "landing:tldv:oh-taeyun",
  harin: "landing:tldv:yoon-harin",
  jiho: "landing:tldv:moon-jiho",
  daon: "landing:tldv:song-daon",
} as const;

export type Person = keyof typeof FACE;

export function usePersonName() {
  const t = useTranslations("landing.people");
  return (who: Person) => t(who);
}

export function Face({
  who,
  size = 20,
  className,
}: {
  who: Person;
  size?: number;
  className?: string;
}) {
  return <PersonAvatar name={FACE[who]} size={size} className={className} />;
}

export function SpeakerFace({
  label,
  size = 20,
  className,
}: {
  label: string;
  size?: number;
  className?: string;
}) {
  return (
    <PersonAvatar
      name={unnamedSpeakerAvatarKey(label)}
      size={size}
      className={className}
    />
  );
}

export function FacePile({
  names,
  size = 22,
  ring = "ring-white",
  className,
}: {
  names: Person[];
  size?: number;
  ring?: string;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("flex shrink-0", className)}>
      {names.map((name, i) => (
        <Face
          key={name}
          who={name}
          size={size}
          className={cn("ring-[1.5px]", ring, i > 0 && "-ml-[5px]")}
        />
      ))}
    </span>
  );
}

export function AppWindow({
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  as?: "div" | "figure" | "section" | "article";
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn(
        "relative overflow-hidden bg-white text-left",
        APP.ink,
        RADIUS.window,
        SHADOW.panel,
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

const TABS: readonly NoteTab[] = ["info", "script", "timeline", "summary"];

export function StatusChip({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const t = useTranslations("landing.app.status");
  const live = status === "recording";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-[11px] font-semibold",
        live ? APP.rec : APP.muted,
        className
      )}
    >
      {status === "paused" ? (
        <Pause aria-hidden className="size-3.5" />
      ) : (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            live ? APP.recBg : "bg-[var(--el-muted)]"
          )}
        />
      )}
      {t(status)}
    </span>
  );
}

function TabStrip({
  active,
  size = "md",
  className,
}: {
  active: NoteTab;
  size?: "md" | "sm";
  className?: string;
}) {
  const t = useTranslations("landing.app");
  return (
    <span className={cn("flex items-stretch", className)}>
      <span className="sr-only">
        {t("tabSr", { tab: t(`tabs.${active}`) })}
      </span>
      <span
        aria-hidden
        className={cn("flex items-stretch", size === "sm" ? "gap-4" : "gap-5")}
      >
        {TABS.map((tab) => (
          <span
            key={tab}
            className={cn(
              "relative flex items-center font-medium whitespace-nowrap",
              size === "sm" ? "text-[12px]" : "text-[13px]",
              tab === active ? APP.ink : "text-[var(--el-ink)]/60"
            )}
          >
            {t(`tabs.${tab}`)}
            {tab === active ? (
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--el-ink)]" />
            ) : null}
          </span>
        ))}
      </span>
    </span>
  );
}

export function MiniBar({
  status,
  tab,
  title,
  size = "sm",
  className,
}: {
  status: Status;
  tab: NoteTab;
  title?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  const row = size === "md" ? "min-h-10" : "min-h-9";
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-x-3 border-b",
        APP.line,
        size === "md" ? "min-h-12 px-5" : "min-h-10 px-4",
        className
      )}
    >
      <span className={cn("flex min-w-0 flex-auto items-center gap-2", row)}>
        <StatusChip status={status} />
        {title ? (
          <span
            className={cn(
              "w-0 grow truncate text-[13px] font-semibold",
              APP.ink
            )}
          >
            {title}
          </span>
        ) : null}
      </span>
      <TabStrip
        active={tab}
        size={size}
        className={cn("-mb-px self-stretch", row)}
      />
    </div>
  );
}

const HEAD_ICON = {
  date: CalendarDays,
  calendar: Calendar,
  length: Clock,
  people: Users,
  project: Folder,
} as const;

const HEAD_CHIP = cn(
  "inline-flex h-[26px] min-w-0 items-center gap-1.5 rounded-[8px] border text-[12.5px]",
  APP.line,
  APP.body
);

export function HeadChip({
  icon,
  children,
}: {
  icon: keyof typeof HEAD_ICON;
  children: ReactNode;
}) {
  const Icon = HEAD_ICON[icon];
  return (
    <span className={cn(HEAD_CHIP, "px-[9px]")}>
      <Icon aria-hidden className={cn("size-[13px] shrink-0", APP.muted)} />
      <span className="truncate">{children}</span>
    </span>
  );
}

export function FacesChip({ names }: { names: Person[] }) {
  const t = useTranslations("landing.app");
  const name = usePersonName();
  return (
    <span className={cn(HEAD_CHIP, "pr-[9px] pl-1")}>
      <FacePile names={names.slice(0, 4)} size={18} />
      <span className="truncate">
        {names.length > 1
          ? t("facesChip", { first: name(names[0]), others: names.length - 1 })
          : name(names[0])}
      </span>
    </span>
  );
}

export function ReviewHead({
  state,
  title,
  chips,
  aside,
  titleSize = "md",
  className,
}: {
  state?: "review" | "confirmed";
  title: ReactNode;
  chips?: ReactNode;
  aside?: ReactNode;
  titleSize?: "md" | "lg";
  className?: string;
}) {
  const t = useTranslations("landing.app.reviewState");
  return (
    <header className={cn("pb-1", className)}>
      {state ? (
        <div className="flex min-h-8 items-center gap-3">
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-[6px] px-[7px] text-[11px] font-semibold transition-colors duration-200 ease-out",
              state === "confirmed" ? APP.success : cn(APP.chipBg, APP.body)
            )}
          >
            {t(state)}
          </span>
          {aside ? <span className="ml-auto">{aside}</span> : null}
        </div>
      ) : null}
      <p
        className={cn(
          "m-0 font-medium tracking-[-0.4px]",
          APP.ink,
          state && "mt-2.5",
          titleSize === "lg"
            ? "text-[28px] leading-[38px]"
            : "text-[24px] leading-[32px]"
        )}
      >
        {title}
      </p>
      {chips ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">{chips}</div>
      ) : null}
    </header>
  );
}

export function SectionHead({
  title,
  count,
  aside,
  className,
}: {
  title: string;
  count?: number;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex h-7 items-center justify-between gap-3", className)}
    >
      <p
        className={cn(
          "m-0 flex items-baseline gap-[7px] text-[16px] font-semibold",
          APP.ink
        )}
      >
        {title}
        {count === undefined ? null : (
          <span
            className={cn("text-[13px] font-normal tabular-nums", APP.muted)}
          >
            {count}
          </span>
        )}
      </p>
      <span className="flex items-center gap-2">
        {aside}
        <Copy aria-hidden className={cn("size-3.5", APP.faint)} />
      </span>
    </div>
  );
}

const ROW_CONTENT = "block min-w-0 text-[15px] leading-6";

const ROW_LINE = "tv-row border-b";

function RowChevron({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("flex justify-end", APP.faint, className)}>
      <ChevronDown
        className={cn("size-4", open && "rotate-180 text-[var(--el-ink)]")}
      />
    </span>
  );
}

export function DecisionRow({
  text,
  topic,
  at,
  open = false,
  excluded = false,
  suggestions,
  children,
  className,
}: {
  text: ReactNode;
  topic?: string;
  at?: string;
  open?: boolean;
  excluded?: boolean;
  suggestions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(ROW_LINE, APP.lineSoft, className)}>
      <div
        className={cn(
          "-mx-2 grid grid-cols-[16px_minmax(0,1fr)_auto_16px] items-center gap-x-3 rounded-[8px] px-2 py-[11px] transition-colors duration-200 ease-out",
          open && APP.chipBg
        )}
      >
        <span aria-hidden className="flex">
          <TimelineToneIcon tone="decision" />
        </span>
        <span
          className={cn(
            ROW_CONTENT,
            APP.ink,
            open && "font-semibold",
            excluded && "text-[var(--el-muted)] line-through"
          )}
        >
          {text}
        </span>
        <span className="flex min-w-0 items-center justify-end gap-3">
          {topic ? (
            <span
              className={cn(
                "hidden max-w-[180px] truncate text-[12.5px] sm:block",
                open ? APP.body : APP.muted
              )}
            >
              {topic}
            </span>
          ) : null}
          {at ? (
            <span
              className={cn(
                "inline-flex h-[22px] items-center rounded-[6px] px-[7px] text-[12px] tabular-nums",
                APP.softBg,
                APP.body
              )}
            >
              {at}
            </span>
          ) : null}
        </span>
        <RowChevron open={open} />
      </div>
      {suggestions ? (
        <div className="space-y-1.5 pb-2.5 sm:pl-7">{suggestions}</div>
      ) : null}
      {open && children ? (
        <div className="space-y-2.5 pt-1 pb-3.5 sm:pl-7">{children}</div>
      ) : null}
    </div>
  );
}

function Assignee({ who }: { who: { name: Person } | { label: string } }) {
  const t = useTranslations("landing.app");
  const name = usePersonName();
  const unnamed = "label" in who;
  return (
    <span className="inline-flex h-7 min-w-0 items-center">
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 text-[13px]",
          APP.ink
        )}
      >
        {unnamed ? (
          <SpeakerFace label={who.label} size={18} />
        ) : (
          <Face who={who.name} size={18} />
        )}
        <span className={cn("truncate", unnamed && APP.muted)}>
          {unnamed ? t("speaker", { label: who.label }) : name(who.name)}
        </span>
        {unnamed ? (
          <span
            aria-hidden
            className="size-[5px] shrink-0 rounded-full bg-[var(--el-muted-soft)]"
          />
        ) : null}
      </span>
    </span>
  );
}

function Due({ due, editable }: { due: string | null; editable: boolean }) {
  const t = useTranslations("landing.app");
  if (!due && !editable) return null;
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 rounded-[7px] px-[9px] text-[13px] whitespace-nowrap tabular-nums",
        due
          ? cn(APP.softBg, APP.body)
          : "border border-dashed border-[#efc2a8] text-[#b4501f]"
      )}
    >
      <CalendarDays aria-hidden className="size-[13px] shrink-0" />
      {due ?? t("setDue")}
    </span>
  );
}

export function TaskRow({
  text,
  who,
  due,
  editable = true,
  excluded = false,
  wide = false,
  open = false,
  suggestions,
  children,
  className,
}: {
  text: ReactNode;
  who?: { name: Person } | { label: string };
  due?: string | null;
  editable?: boolean;
  excluded?: boolean;
  wide?: boolean;
  open?: boolean;
  suggestions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("landing.app");
  const dueChip =
    due === undefined ? null : <Due due={due} editable={editable} />;
  const assignee = who ? (
    <Assignee who={who} />
  ) : editable ? (
    <span className={cn("inline-flex h-7 items-center text-[13px]", APP.muted)}>
      {t("setAssignee")}
    </span>
  ) : null;
  return (
    <div className={cn(ROW_LINE, APP.lineSoft, className)}>
      <div
        className={cn(
          "-mx-2 grid items-center gap-x-3 rounded-[8px] px-2 py-[11px] transition-colors duration-200 ease-out",
          wide
            ? "grid-cols-[16px_minmax(0,1fr)_16px] sm:grid-cols-[16px_minmax(0,1fr)_132px_150px_16px]"
            : "grid-cols-[16px_minmax(0,1fr)_16px]",
          open && APP.chipBg
        )}
      >
        <span
          aria-hidden
          className="size-4 rounded-[4px] border-[1.5px] border-[var(--el-hairline-strong)]"
        />
        <span
          className={cn(
            ROW_CONTENT,
            APP.ink,
            open && "font-semibold",
            excluded && "text-[var(--el-muted)] line-through"
          )}
        >
          {text}
        </span>
        {assignee || dueChip ? (
          <div
            className={cn(
              "col-[2/-1] row-start-2 flex min-w-0 flex-wrap items-center gap-x-3 pt-1.5",
              wide && "sm:contents"
            )}
          >
            {assignee ?? <span />}
            {dueChip ? <span className="flex">{dueChip}</span> : null}
          </div>
        ) : null}
        <RowChevron
          open={open}
          className={cn("col-start-3 row-start-1", wide && "sm:col-start-5")}
        />
      </div>
      {suggestions ? (
        <div className="space-y-1.5 pb-2.5 sm:pl-7">{suggestions}</div>
      ) : null}
      {open && children ? (
        <div className="space-y-2.5 pt-1 pb-3.5 sm:pl-7">{children}</div>
      ) : null}
    </div>
  );
}

export function EvidenceQuotes({
  quotes,
  className,
}: {
  quotes: Array<{
    who?: Person;
    label?: string;
    at: string;
    text: ReactNode;
    cited: boolean;
  }>;
  className?: string;
}) {
  const t = useTranslations("landing.app");
  const name = usePersonName();
  return (
    <ul
      className={cn(
        "m-0 flex list-none flex-col gap-1 rounded-[10px] border px-2 py-1.5",
        "max-sm:rounded-none max-sm:border-0 max-sm:border-l-2 max-sm:py-0 max-sm:pr-0 max-sm:pl-1.5",
        APP.line,
        className
      )}
    >
      {quotes.map((quote) => (
        <li
          key={`${quote.at}-${quote.who ?? quote.label}`}
          className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-2.5 rounded-[8px] px-1.5 py-1.5"
        >
          <span className="pt-0.5">
            {quote.who ? (
              <Face who={quote.who} />
            ) : quote.label ? (
              <SpeakerFace label={quote.label} />
            ) : null}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className={cn("text-[12.5px] leading-5", APP.muted)}>
              <span className={cn("font-medium", APP.body)}>
                {quote.who
                  ? name(quote.who)
                  : quote.label
                    ? t("speaker", { label: quote.label })
                    : t("noSpeaker")}
              </span>
              {" · "}
              <span className="tabular-nums">{quote.at}</span>
            </span>
            <span
              className={cn(
                "text-[14px] leading-[22px]",
                quote.cited ? APP.ink : APP.muted
              )}
            >
              {quote.text}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RowActions({ excluded = false }: { excluded?: boolean }) {
  const t = useTranslations("landing.app");
  const button = cn(
    "inline-flex h-6 items-center rounded-[8px] border bg-[var(--el-canvas)] px-2 text-[12px] font-medium",
    APP.line,
    APP.ink
  );
  return (
    <span className="flex flex-wrap gap-1.5">
      {excluded ? null : <span className={button}>{t("edit")}</span>}
      <span className={button}>
        {excluded ? t("undoExclude") : t("exclude")}
      </span>
    </span>
  );
}

function Count({ value }: { value: number }) {
  return (
    <b
      key={value}
      className={cn(
        "inline-block font-semibold tabular-nums animate-in fade-in-0 zoom-in-95 duration-200 ease-out motion-reduce:animate-none",
        APP.ink
      )}
    >
      {value}
    </b>
  );
}

type ConfirmState =
  | { kind: "ready"; decisions: number; tasks: number; ended?: number }
  | { kind: "unchosen"; n: number };

const BAR = {
  float: cn(
    "relative flex min-h-[50px] max-w-full flex-wrap items-center gap-x-3.5 gap-y-1 rounded-[14px] border bg-white/[0.98] py-[7px] pr-[7px] pl-[18px]",
    APP.line,
    SHADOW.app
  ),
  pill: cn(
    "relative mx-auto flex w-fit max-w-[min(100%,264px)] items-center gap-x-2.5 rounded-[22px] border bg-white/[0.98] py-1.5 pr-[7px] pl-4",
    APP.line,
    SHADOW.app
  ),
  plate:
    "relative flex min-h-[50px] max-w-full flex-wrap items-center gap-x-3.5 gap-y-1 rounded-[12px] bg-[var(--el-canvas)] py-[7px] pr-[7px] pl-4",
  dock: cn(
    "flex flex-wrap items-center gap-x-3 gap-y-2 border-t bg-white px-4 py-3",
    APP.lineSoft
  ),
} as const;

export function ConfirmBar({
  variant = "float",
  state,
  buttonSlot,
  className,
}: {
  variant?: keyof typeof BAR;
  state: ConfirmState;
  buttonSlot?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("landing.app.confirm");
  const pill = variant === "pill";
  return (
    <div className={cn(BAR[variant], className)}>
      {state.kind === "unchosen" ? (
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={cn(
              "inline-flex items-center gap-2 font-medium text-[#b4501f]",
              pill ? "text-[12.5px]" : "text-[13.5px]"
            )}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-[#eb6834]" />
            <span className="whitespace-nowrap">
              {t.rich("unchosen", {
                count: state.n,
                n: () => <Count value={state.n} />,
              })}
            </span>
          </span>
          <span
            className={cn(
              "whitespace-nowrap underline decoration-[var(--el-hairline-strong)] underline-offset-[3px]",
              pill ? "text-[12px]" : "text-[13px]",
              APP.body
            )}
          >
            {t("goToSuggestions")}
          </span>
        </span>
      ) : (
        <span
          className={cn(
            "min-w-0",
            pill ? "text-[12.5px] leading-[1.4]" : "text-[13.5px]",
            APP.body
          )}
        >
          <span>
            {t.rich("counts", {
              ...RICH,
              decisions: state.decisions,
              tasks: state.tasks,
              d: () => <Count value={state.decisions} />,
              t: () => <Count value={state.tasks} />,
            })}
          </span>{" "}
          {t.rich("target", RICH)}
          {state.ended ? (
            <>
              {" "}
              <span>
                {t.rich("ended", {
                  ...RICH,
                  count: state.ended,
                  n: () => <Count value={state.ended ?? 0} />,
                })}
              </span>
            </>
          ) : null}
        </span>
      )}
      {pill ? null : (
        <span
          aria-hidden
          className="hidden h-5 w-px bg-[var(--el-hairline)] sm:block"
        />
      )}
      <span
        className={cn(
          "relative ml-auto inline-flex shrink-0 items-center font-medium",
          pill
            ? "h-8 rounded-full px-3.5 text-[12.5px]"
            : "h-9 rounded-[9px] px-4 text-[13px]",
          APP.primary,
          state.kind === "unchosen" && "opacity-50"
        )}
      >
        {t("button")}
        {buttonSlot}
      </span>
    </div>
  );
}

export const CHOICE = {
  group:
    "inline-flex shrink-0 rounded-full bg-[var(--el-surface-strong)] p-0.5",
  option:
    "inline-flex h-[22px] items-center gap-1 rounded-full border border-transparent px-2.5 text-[11.5px] font-medium whitespace-nowrap text-[var(--el-muted)]",
  changeOn:
    "border-[var(--el-success)]/30 bg-[var(--el-success)]/10 text-[var(--el-success-strong)]",
  keepOn: "bg-[var(--el-primary)] text-white",
} as const;

export function ChoiceCheck() {
  return <Check aria-hidden className="size-[11px]" strokeWidth={3} />;
}

export function ReplacementRow({
  target,
  meta,
  reason,
  toggle,
  className,
}: {
  target: ReactNode;
  meta: ReactNode;
  reason?: ReactNode;
  toggle: ReactNode;
  className?: string;
}) {
  const t = useTranslations("landing.app");
  return (
    <div
      className={cn(
        "rounded-[8px] px-3 py-2.5 text-[12.5px]",
        APP.softBg,
        APP.body,
        className
      )}
    >
      <div className="grid grid-cols-1 items-center justify-items-start gap-x-3 gap-y-1.5">
        <span className={cn("text-[12px] whitespace-nowrap", APP.muted)}>
          {t("replacement")}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn(APP.ink)}>{target}</span>
          <span className={cn("text-[12px]", APP.muted)}>{meta}</span>
        </span>
        {toggle}
      </div>
      {reason ? (
        <p className={cn("m-0 mt-1.5 text-[12px]", APP.muted)}>{reason}</p>
      ) : null}
    </div>
  );
}

export function AgendaHead({
  range,
  title,
  total,
  open = true,
  live = false,
  blink = false,
  as: Tag = "div",
  className,
  ...rest
}: {
  range?: string;
  title: string;
  total: number;
  open?: boolean;
  live?: boolean;
  blink?: boolean;
  as?: "div" | "button" | "h3" | "h4";
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "title">) {
  const t = useTranslations("landing.app");
  const buttonProps: Record<string, string> =
    Tag === "button" ? { type: "button" } : {};
  return (
    <Tag
      {...buttonProps}
      className={cn(
        "-mx-2 flex h-[30px] w-[calc(100%+16px)] items-center gap-0.5 text-left",
        className
      )}
      {...rest}
    >
      {range ? (
        <span
          className={cn("shrink-0 px-2 text-[12px] tabular-nums", APP.muted)}
        >
          {range}
        </span>
      ) : null}
      <span
        className={cn(
          "flex h-full min-w-0 flex-1 items-center gap-2.5 pr-2",
          range ? "pl-1" : "pl-2"
        )}
      >
        <span
          className={cn("min-w-0 truncate text-[15px] font-semibold", APP.ink)}
        >
          {title}
        </span>
        <span
          className={cn("-ml-1 shrink-0 text-[12.5px] tabular-nums", APP.muted)}
        >
          {total}
        </span>
        <ChevronRight
          aria-hidden
          className={cn(
            "-ml-1.5 size-3.5 shrink-0",
            APP.faint,
            open && "rotate-90"
          )}
        />
        <span className="flex-1" />
        {live ? (
          <LiveChip
            dotClassName={blink ? "tv-blink" : undefined}
            label={t("live")}
          />
        ) : null}
      </span>
    </Tag>
  );
}

export function TimelineList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ol className={cn("relative m-0 list-none p-0", className)}>
      <span
        aria-hidden
        className="absolute top-4 bottom-4 left-[63px] w-px bg-[var(--el-hairline)]"
      />
      {children}
    </ol>
  );
}

export function TimelineRow({
  at,
  tone,
  kind,
  title,
  meta,
  metaTone,
  retracted = false,
  flash = false,
  dim = false,
  open = false,
  cites,
  className,
}: {
  at: string;
  tone: TimelineTone;
  kind: string;
  title: ReactNode;
  meta?: string;
  metaTone?: "error";
  retracted?: boolean;
  flash?: boolean;
  dim?: boolean;
  open?: boolean;
  cites?: Array<{ at: string; text: ReactNode }>;
  className?: string;
}) {
  const t = useTranslations("landing.app");
  const parts = [
    ...(retracted ? [{ text: t("retracted"), error: true }] : []),
    ...(meta ? [{ text: meta, error: metaTone === "error" }] : []),
  ];
  return (
    <li
      className={cn(
        TIMELINE_ROW_GRID,
        "tv-dim relative py-[7px]",
        flash && "tv-flash rounded-[8px]",
        dim ? "opacity-40" : "opacity-100",
        className
      )}
    >
      <span
        className={cn(
          "self-start text-right text-[12px] leading-6 tabular-nums",
          APP.muted
        )}
      >
        {at}
      </span>
      <span className="flex justify-center pt-1">
        <span className="inline-flex rounded-full bg-white">
          <TimelineToneIcon tone={tone} retracted={retracted} />
        </span>
      </span>
      <div className="min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
          <span className="flex min-w-0 flex-col">
            <span
              className={cn(
                "text-[15px] leading-6",
                retracted
                  ? "text-[var(--el-muted)] line-through"
                  : TONE_TITLE[tone]
              )}
            >
              {title}
            </span>
            <span className={cn("text-[12.5px] leading-[19px]", APP.muted)}>
              <span className={TONE_TEXT[tone]}>{kind}</span>
              {parts.map((part) => (
                <span key={part.text}>
                  <Dots />
                  <span
                    className={
                      part.error ? cn("font-medium", APP.recStrong) : undefined
                    }
                  >
                    {part.text}
                  </span>
                </span>
              ))}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "mt-1 size-4 text-[var(--el-hairline-strong)]",
              open && "rotate-180"
            )}
          />
        </div>
        {open && cites?.length ? (
          <div
            className={cn(
              "mt-2.5 overflow-hidden rounded-[10px] border",
              APP.line
            )}
          >
            <ul className="m-0 flex list-none flex-col gap-0.5 px-2 py-2">
              {cites.map((cite) => (
                <li
                  key={cite.at}
                  className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-2.5 rounded-[7px] px-1.5 py-1"
                >
                  <span
                    className={cn(
                      "text-[12px] leading-[22px] tabular-nums",
                      APP.muted
                    )}
                  >
                    {cite.at}
                  </span>
                  <span
                    className={cn("text-[14px] leading-[22px]", APP.bodyStrong)}
                  >
                    {cite.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function ScriptRow({
  at,
  speaker,
  live = false,
  children,
  className,
}: {
  at: string;
  speaker?: { name: Person } | { label: string };
  live?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations("landing.app");
  const name = usePersonName();
  const unnamed = speaker !== undefined && "label" in speaker;
  return (
    <div
      className={cn(
        "grid grid-cols-[58px_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[66px_minmax(0,1fr)] sm:gap-6",
        live
          ? cn("tv-row -mx-4 rounded-[6px] px-4", APP.softBg)
          : cn(ROW_LINE, APP.line),
        className
      )}
    >
      {live ? (
        <span
          className={cn(
            "flex items-center gap-1.5 self-start pt-1 text-[11px] whitespace-nowrap",
            APP.muted
          )}
        >
          <span
            aria-hidden
            className="size-1.5 shrink-0 animate-pulse rounded-full bg-red-500"
          />
          {t("transcribing")}
        </span>
      ) : (
        <span
          className={cn("pt-1 font-mono text-[11px] tabular-nums", APP.muted)}
        >
          {at}
        </span>
      )}
      <div className="min-w-0">
        {speaker ? (
          <span
            className={cn(
              "mb-1 inline-flex items-center gap-1.5 text-[13px] font-medium",
              APP.muted
            )}
          >
            {unnamed ? (
              <SpeakerFace label={speaker.label} />
            ) : (
              <Face who={speaker.name} />
            )}
            {unnamed
              ? t("speaker", { label: speaker.label })
              : name(speaker.name)}
            {unnamed ? (
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full bg-[var(--el-muted-soft)]"
              />
            ) : null}
          </span>
        ) : null}
        <p
          className={cn(
            "m-0 text-[15px] leading-7 tracking-[0.005em]",
            live ? APP.body : APP.ink
          )}
        >
          {children}
          {live ? (
            <span
              aria-hidden
              className="ml-1 inline-block h-4 w-px animate-pulse bg-[var(--el-muted)] align-middle"
            />
          ) : null}
        </p>
      </div>
    </div>
  );
}

export function RailHead({ className }: { className?: string }) {
  const t = useTranslations("landing.app.rail");
  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center gap-2 border-b pr-2 pl-4",
        APP.line,
        className
      )}
    >
      <Sparkles aria-hidden className={cn("size-[15px] shrink-0", APP.ink)} />
      <span className={cn("shrink-0 text-[13px] font-semibold", APP.ink)}>
        {t("title")}
      </span>
      <span className={cn("min-w-0 truncate text-[12px]", APP.muted)}>
        {t("private")} · {t("scope")}
      </span>
      <span className="flex-1" />
      <span
        aria-hidden
        className={cn(
          "flex size-8 shrink-0 items-center justify-center",
          APP.muted
        )}
      >
        <PanelRightClose className="size-4" />
      </span>
    </div>
  );
}

export function ThreadTitle({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 border-b py-3 pr-3 pl-5",
        APP.line,
        className
      )}
    >
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[14px] font-medium",
          APP.ink
        )}
      >
        {title}
      </span>
      <span aria-hidden className={cn("flex items-center", APP.ink)}>
        <span className="flex size-8 items-center justify-center">
          <Plus className="size-4" />
        </span>
        <span className="flex size-8 items-center justify-center">
          <History className="size-4" />
        </span>
      </span>
    </div>
  );
}

export function ScopeChip({
  kind = "note",
  title,
  className,
}: {
  kind?: "note" | "project";
  title: string;
  className?: string;
}) {
  const Icon = kind === "project" ? Folder : FileText;
  return (
    <span className={scopeChipClass(kind, { extra: className })}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{title}</span>
    </span>
  );
}

export function UserBubble({
  chip,
  children,
  className,
}: {
  chip?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-end", className)}>
      <p
        className={cn(
          "m-0 max-w-[85%] rounded-[16px] px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap",
          APP.chipBg,
          APP.ink
        )}
      >
        {chip}
        {children}
      </p>
    </div>
  );
}

export function Answer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("m-0 text-[14px] leading-[1.65]", APP.body, className)}>
      {children}
    </p>
  );
}

export function RefChips({ refs }: { refs: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5 pt-1.5">
      {refs.map((ref) => (
        <span
          key={ref}
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--el-hairline-strong)] px-2 py-0.5 text-[11px]",
            APP.body
          )}
        >
          <FileText aria-hidden className="size-3 shrink-0" />
          <span className="truncate">{ref}</span>
        </span>
      ))}
    </span>
  );
}

export function Composer({
  chip,
  busy = false,
  children,
  className,
}: {
  chip?: ReactNode;
  busy?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("landing.app");
  const empty = !chip && !children;
  return (
    <div
      className={cn(
        "flex shrink-0 items-end gap-2.5 rounded-[10px] border border-[var(--el-hairline-strong)] bg-white px-3.5 py-3",
        className
      )}
    >
      <span
        className={cn(
          "min-h-9 min-w-0 flex-1 py-[5px] text-[15px] leading-[1.75]",
          empty ? APP.muted : APP.ink
        )}
      >
        {empty ? (
          t("composerPlaceholder")
        ) : (
          <>
            {chip}
            {children}
          </>
        )}
      </span>
      {busy ? (
        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border bg-[var(--el-canvas)]",
            APP.line,
            APP.ink
          )}
        >
          <Square className="size-3.5" />
        </span>
      ) : (
        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            APP.primary
          )}
        >
          <ArrowUp className="size-4" />
        </span>
      )}
    </div>
  );
}

function Dots() {
  return (
    <>
      <span aria-hidden className="mx-1.5 text-[var(--el-hairline-strong)]">
        ·
      </span>
      <span className="sr-only">, </span>
    </>
  );
}
