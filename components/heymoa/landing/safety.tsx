import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  PencilLine,
  Plug,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentType, ReactNode } from "react";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { cn } from "@/lib/utils";

import { Answer, AppWindow, Composer, RailHead, ScopeChip, UserBubble } from "./app";
import { Cursor, Hand, Scribble, Sticky } from "./marks";
import { RICH } from "./rich";
import {
  APP,
  BODY,
  CARD_TITLE,
  CONTAINER,
  H2,
  LEAD,
  MARKER_REVEAL,
  RADIUS,
  SECTION_Y,
  SHADOW,
  vars,
} from "./tokens";

const PEN =
  "tv-rmark bg-[linear-gradient(color-mix(in_srgb,var(--tv-pop)_55%,transparent),color-mix(in_srgb,var(--tv-pop)_55%,transparent))] bg-no-repeat [background-size:100%_0.62em] [background-position:0_92%] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]";

const CURSOR_AT = "top-[55%] left-[-5px]";

function TileHead({
  icon: Icon,
  label,
  title,
  bodyClassName,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  title: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-extrabold text-[var(--tv-ink)]">
        <Icon aria-hidden className="size-3.5" />
        {label}
      </span>
      <h3 className={`${CARD_TITLE} mt-4 text-balance lg:text-[28px]`}>{title}</h3>
      <p className={cn(BODY, "mt-2", bodyClassName)}>{children}</p>
    </div>
  );
}

function PanelNo({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute -top-4 -left-2 z-10 grid size-8 sm:-left-4 place-items-center rounded-full bg-[var(--tv-ink)] text-[14px] font-extrabold text-white",
        SHADOW.sticky
      )}
    >
      {n}
    </span>
  );
}

function Step({
  n,
  title,
  note,
  className,
  children,
}: {
  n: number;
  title: string;
  note: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full bg-[var(--tv-ink)] text-[20px] font-extrabold text-white lg:size-12 lg:text-[22px]",
            SHADOW.sticky
          )}
        >
          {n}
        </span>
        <div className="min-w-0 pt-1.5">
          <Hand aria-hidden={false} className="block text-[19px] leading-[1.3] lg:text-[21px]">
            {title}
          </Hand>
          <p className={cn(BODY, "mt-1.5")}>{children}</p>
        </div>
      </div>
      {note}
    </div>
  );
}

function Pointer({
  tone,
  tilt,
  delay,
  arrow,
  className,
  children,
}: {
  tone: "pop" | "white";
  tilt: number;
  delay: number;
  arrow: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("relative z-20 mt-4 mr-2 ml-auto w-fit lg:mr-0", className)}>
      <Sticky tone={tone} size="md" tilt={tilt} anim="reveal" delay={delay}>
        {children}
      </Sticky>
      <Scribble
        kind="arrow"
        draw="reveal"
        delay={delay + 200}
        rotate={arrow}
        className="absolute top-1/2 left-[calc(100%+4px)] hidden h-[32px] w-[52px] -translate-y-1/2 lg:block"
      />
    </div>
  );
}

function useCall() {
  const t = useTranslations("landing.safety.agent");
  const issue = t("issue");
  return { issue, call: t("call", { issue }) };
}

function Arg({ k, className, children }: { k: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-0.5 sm:flex-row sm:gap-3", className)}>
      <dt className={cn("shrink-0 text-[11px] leading-5 font-medium sm:w-20", APP.muted)}>{k}</dt>
      <dd className={cn("m-0 min-w-0 flex-1 text-xs leading-5 break-words", APP.body)}>
        {children}
      </dd>
    </div>
  );
}

function ApprovalCard({ className }: { className?: string }) {
  const t = useTranslations("landing.safety.agent");
  const { issue, call } = useCall();
  return (
    <div className={cn("border-t border-[var(--el-hairline)] pt-3.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("m-0 min-w-0 flex-1 text-sm leading-relaxed", APP.ink)}>
          {call}
        </p>
        <span
          className={cn(
            "inline-flex h-5 shrink-0 items-center gap-1 rounded-[6px] px-2 text-xs font-medium whitespace-nowrap",
            APP.chipBg,
            APP.ink
          )}
        >
          <PencilLine aria-hidden className="size-3" />
          {t("writeTool")}
        </span>
      </div>
      <dl className="m-0 mt-3 flex flex-col gap-1.5 rounded-[10px] bg-[var(--el-canvas-soft)] px-3 py-2.5">
        <Arg k="title">{issue}</Arg>
        <Arg k="description">{t("description")}</Arg>
      </dl>
      <div className="mt-3 flex gap-2">
        <span
          className={cn(
            "relative inline-flex h-[30px] items-center rounded-[8px] px-2.5 text-[0.8rem] font-medium",
            APP.primary
          )}
        >
          {t("approve")}
          <Cursor className={CURSOR_AT} />
        </span>
        <span
          className={cn(
            "inline-flex h-[30px] items-center rounded-[8px] border bg-[var(--el-canvas)] px-2.5 text-[0.8rem] font-medium",
            APP.line,
            APP.ink
          )}
        >
          {t("decline")}
        </span>
      </div>
      <p className={cn("m-0 mt-2 text-[11px] leading-relaxed", APP.muted)}>
        {t("waiting")}
      </p>
    </div>
  );
}

function StepDone({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <Check aria-hidden className={cn("mt-[3px] size-3 shrink-0", APP.muted)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const NARROW_HEAD = "@max-xs:[&>.truncate]:hidden";

const DOCKED = "rounded-none border-0 border-t border-[var(--el-hairline)] px-0 pt-3 pb-0";

const FACE = cn(RADIUS.face, "max-sm:-mx-5 max-sm:rounded-none");

const COL = "mx-auto w-full max-w-[560px] lg:mx-0 lg:max-w-none";

function AgentTile() {
  const t = useTranslations("landing.safety.agent");
  const { call } = useCall();
  const chip = <ScopeChip title={t("scope")} />;
  return (
    <Reveal
      className={cn(
        "tv-land relative origin-bottom bg-[var(--tv-butter)] p-5 pb-12 sm:p-8 lg:p-10",
        FACE
      )}
      style={vars({
        "--fy": "90px",
        "--fs": 0.92,
        "--ty": "140px",
        "--ts": 0.92,
      })}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-12 lg:gap-y-9">
        <div className="flex flex-col">
          <TileHead icon={Sparkles} label={t("label")} title={t("title")}>
            {t("body")}
          </TileHead>
          <Step
            n={1}
            title={t("step1.title")}
            className={cn(COL, "mt-8 lg:mt-auto lg:mb-[127px]")}
            note={
              <Pointer tone="pop" tilt={-4} delay={750} arrow={22}>
                {t("step1.note")}
              </Pointer>
            }
          >
            {t("step1.body")}
          </Step>
        </div>

        <figure
          className={cn("tv-rslide tv-land relative m-0", COL, "mt-6 lg:mt-0 lg:self-end")}
          style={vars({
            "--d": "100ms",
            "--fx": "80px",
            "--fy": "50px",
            "--fr": "3deg",
          })}
        >
          <figcaption className="sr-only">{t("figure1")}</figcaption>
          <div className="relative -rotate-1 lg:-rotate-[1.5deg]">
            <PanelNo n={1} />
            <AppWindow className="@container">
              <RailHead className={NARROW_HEAD} />
              <div className="px-4 pt-4 pb-5 sm:px-5 sm:pt-5">
                <UserBubble chip={chip}>{t("ask")}</UserBubble>
                <Answer className="mt-4">{t("answer")}</Answer>
                <ApprovalCard className="mt-3" />
                <Composer chip={chip} busy className={cn("mt-4", DOCKED)} />
                <p className={cn("m-0 mt-2 text-xs", APP.muted)}>{t("locked")}</p>
              </div>
            </AppWindow>
          </div>
        </figure>

        <Step
          n={2}
          title={t("step2.title")}
          className={cn(COL, "mt-12 lg:mt-0 lg:pt-3")}
          note={
            <Pointer tone="white" tilt={3} delay={1100} arrow={22} className="lg:-mr-[88px]">
              {t("step2.note")}
            </Pointer>
          }
        >
          {t("step2.body")}
        </Step>

        <div className={cn(COL, "mt-6 lg:mt-0")}>
          <figure
            className="tv-rslide tv-land relative m-0 ml-auto w-full lg:w-[84%]"
            style={vars({
              "--d": "450ms",
              "--fx": "130px",
              "--fy": "70px",
              "--fr": "-4deg",
            })}
          >
            <figcaption className="sr-only">{t("figure2")}</figcaption>
            <div className="relative rotate-1 lg:rotate-[1.5deg]">
              <PanelNo n={2} />
              <AppWindow className="@container">
                <RailHead className={NARROW_HEAD} />
                <div className="p-4 sm:p-5">
                  <div className="border-l border-[var(--el-hairline-strong)] pl-3.5">
                    <span className="-ml-1 flex items-center gap-1.5 py-0.5">
                      <ChevronRight
                        aria-hidden
                        className={cn("size-3.5 shrink-0 rotate-90", APP.muted)}
                      />
                      <span className={cn("text-xs", APP.muted)}>{t("thinking")}</span>
                    </span>
                    <div className="space-y-1.5 pt-1.5 pb-0.5">
                      <StepDone>
                        <p className={cn("m-0 text-xs leading-relaxed", APP.muted)}>
                          {t("created", { call })}
                        </p>
                        <span
                          className={cn(
                            "relative mt-1 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2",
                            APP.ink
                          )}
                        >
                          {t("open")}
                          <ExternalLink aria-hidden className="size-3" />
                          <Scribble
                            kind="circle"
                            draw="reveal"
                            delay={1300}
                            className="absolute -top-1.5 -left-2.5 h-[calc(100%+12px)] w-[calc(100%+20px)]"
                          />
                        </span>
                      </StepDone>
                      <StepDone>
                        <p className={cn("m-0 text-xs leading-relaxed", APP.muted)}>
                          <span className="font-medium text-[var(--el-body-strong)]">
                            {t("approved")}
                          </span>
                          {` · ${call}`}
                        </p>
                      </StepDone>
                    </div>
                  </div>
                </div>
              </AppWindow>
            </div>
          </figure>
        </div>
      </div>
    </Reveal>
  );
}

const USAGE = [
  { at: "t412", tool: "openScreen", n: 1 },
  { at: "t412", tool: "transcript", n: 8 },
  { at: "t411", tool: "meetings", n: 3, wide: true },
  { at: "t411", tool: "projectItems", n: 6, wide: true },
  { at: "t411", tool: "checkConnection", n: 1 },
] as const;

const STAMPS = [
  { id: "workspace", tilt: -8, place: "lg:self-start" },
  { id: "visible", tilt: 6, place: "lg:-mt-2 lg:self-end" },
  { id: "expiry", tilt: -4, place: "lg:-mt-2 lg:self-start" },
] as const;

function DelegationRow() {
  const t = useTranslations("landing.safety.external");
  return (
    <div className="@container mt-5 border-t border-[var(--el-hairline)] pt-4">
      <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center @lg:justify-between @lg:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--el-canvas-soft)]">
            <Bot aria-hidden className={cn("size-4", APP.muted)} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("m-0 truncate text-sm font-medium", APP.ink)}>{t("name")}</p>
              <span
                className={cn(
                  "inline-flex h-5 items-center rounded-[6px] px-2 text-xs font-medium",
                  APP.success
                )}
              >
                {t("connected")}
              </span>
            </div>
            <p className={cn("m-0 mt-1 text-xs", APP.muted)}>
              {t("team")} · <span className="font-mono">hm_k4Tz9Wq…</span>
            </p>
            <p className={cn("m-0 mt-0.5 text-xs", APP.muted)}>
              <span className="whitespace-nowrap">{t("since")}</span>&nbsp;·{" "}
              <span className="whitespace-nowrap">{t("lastUsed")}</span>&nbsp;·{" "}
              <span className={cn(PEN, APP.ink)} style={vars({ "--d": "900ms" })}>
                {t.rich("expiry", RICH)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end @lg:self-auto">
          <span
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-xs font-medium",
              APP.ink
            )}
          >
            {t("usage")}
            <ChevronDown aria-hidden className="size-3.5 rotate-180" />
          </span>
          <span className="relative inline-flex h-8 items-center rounded-[8px] bg-[var(--el-error)]/10 px-2.5 text-[0.8rem] font-medium text-[var(--el-error-strong)]">
            {t("revoke")}
            <Cursor className={CURSOR_AT} />
          </span>
        </div>
      </div>
      <div className="mt-4 border-t border-[var(--el-hairline)] pt-3">
        <ul className="m-0 list-none space-y-1 p-0">
          {USAGE.map((use) => (
            <li
              key={`${use.at}-${use.tool}`}
              className={cn(
                "items-center gap-3 py-1 text-xs",
                "wide" in use ? "hidden sm:flex" : "flex"
              )}
            >
              <span className={cn("shrink-0 tabular-nums @sm:w-28", APP.muted)}>
                {t(`at.${use.at}`)}
              </span>
              <span className={cn("whitespace-nowrap", APP.ink)}>{t(`tools.${use.tool}`)}</span>
              <span className={cn("shrink-0 tabular-nums", APP.muted)}>
                {t("count", { n: use.n })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Notch({ className }: { className: string }) {
  return <span aria-hidden className={cn("absolute size-7 rounded-full bg-white", className)} />;
}

function ExternalTile() {
  const t = useTranslations("landing.safety.external");
  return (
    <Reveal
      className={cn(
        "tv-land relative flex flex-col bg-[var(--tv-mint)] lg:flex-row",
        FACE
      )}
      style={vars({ "--fy": "90px", "--fs": 0.92 })}
    >
      <div className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10">
        <TileHead
          icon={Plug}
          label={t("label")}
          title={t("title")}
          bodyClassName="lg:max-w-[560px]"
        >
          {t("body")}
        </TileHead>

        <figure className="relative m-0 mt-8 lg:mt-9">
          <figcaption className="sr-only">{t("figure")}</figcaption>
          <div
            className="tv-rslide tv-land relative"
            style={vars({
              "--d": "100ms",
              "--fx": "-70px",
              "--fy": "50px",
              "--fr": "-3deg",
            })}
          >
            <AppWindow className="@container rotate-[0.6deg] p-4 sm:p-5 lg:rotate-1">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="m-0 text-[24px] leading-tight font-light tracking-[-0.03em] @md:text-3xl">
                    {t("screenTitle")}
                  </p>
                  <p className={cn("m-0 mt-2 hidden text-sm @md:block", APP.muted)}>
                    {t("screenBody")}
                  </p>
                </div>
                <span
                  className={cn(
                    "hidden h-8 shrink-0 items-center rounded-[8px] px-2.5 text-[0.8rem] font-medium @md:inline-flex",
                    APP.primary
                  )}
                >
                  {t("newConnection")}
                </span>
              </div>
              <DelegationRow />
            </AppWindow>
            <Sticky
              tone="peach"
              size="md"
              tilt={-3}
              anim="reveal"
              delay={1000}
              className="absolute top-[calc(100%-10px)] right-3 w-[min(248px,80%)] sm:right-6 sm:w-[224px]"
            >
              {t("revokeNote")}
            </Sticky>
          </div>
          <div aria-hidden className="mt-7 hidden items-end gap-1 pl-14 lg:flex">
            <Scribble kind="arrow" draw="reveal" delay={1200} rotate={-68} className="h-[32px] w-[50px]" />
            <Hand>{t("logNote")}</Hand>
          </div>
          <div aria-hidden className="h-14 lg:hidden" />
        </figure>
      </div>

      <div className="relative flex shrink-0 flex-col items-center gap-4 border-t-2 border-dashed border-[var(--tv-mint-deep)] px-5 pt-7 pb-8 lg:w-[248px] lg:justify-center lg:gap-6 lg:border-t-0 lg:border-l-2 lg:px-8 lg:py-10">
        <Notch className="-top-[15px] -left-3.5 lg:-top-3.5 lg:-left-[15px]" />
        <Notch className="-top-[15px] -right-3.5 lg:top-auto lg:right-auto lg:-bottom-3.5 lg:-left-[15px]" />
        <p aria-hidden className="m-0 text-center">
          <span className="block text-[12px] font-extrabold tracking-[0.14em] text-[var(--tv-ink)]">
            {t("pass")}
          </span>
          <span className="mt-0.5 block font-mono text-[11px] text-[var(--tv-muted)]">
            No. hm_k4Tz9Wq…
          </span>
        </p>
        <ul className="m-0 flex list-none flex-wrap justify-center gap-2.5 p-0 lg:w-full lg:flex-col lg:flex-nowrap lg:gap-0">
          {STAMPS.map((stamp, i) => (
            <li
              key={stamp.id}
              className={cn(
                "tv-rpop tv-stamp grid size-[88px] place-items-center rounded-full border-2 border-[var(--tv-brand-deep)]/75 p-2 text-center text-[12px] leading-[1.25] font-extrabold text-[var(--tv-brand-deep)] lg:size-[104px] lg:text-[13px]",
                stamp.place
              )}
              style={{
                rotate: `${stamp.tilt}deg`,
                ...vars({
                  "--d": `${500 + i * 160}ms`,
                  "--sr": `${stamp.tilt * 3}deg`,
                }),
              }}
            >
              {t(`stamps.${stamp.id}`)}
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

export function Safety() {
  const t = useTranslations("landing.safety");
  return (
    <section
      id="safety"
      aria-labelledby="safety-title"
      className={`bg-white ${SECTION_Y.white}`}
    >
      <div className={CONTAINER}>
        <Reveal className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-16">
          <h2 id="safety-title" className={H2}>
            {t.rich("title", {
              m: (chunks) => (
                <span className={cn(MARKER_REVEAL, "whitespace-nowrap")}>{chunks}</span>
              ),
            })}
          </h2>
          <p className={`${LEAD} lg:pt-3`}>
            {t("lead")}
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-6 lg:mt-14">
          <AgentTile />
          <ExternalTile />
        </div>
      </div>
    </section>
  );
}
