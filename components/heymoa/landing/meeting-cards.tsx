import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { cn } from "@/lib/utils";

import {
  DecisionRow,
  FacePile,
  FacesChip,
  HeadChip,
  MiniBar,
  type Person,
  ReviewHead,
  SectionHead,
  TaskRow,
  usePersonName,
} from "./app";
import { RICH } from "./rich";
import { Hand, Scribble, Sticky } from "./marks";
import {
  APP,
  CARD_TITLE,
  CONTAINER,
  FOCUS,
  H2,
  MARKER_REVEAL,
  RADIUS,
  SECTION_Y,
  SHADOW,
  vars,
} from "./tokens";
import { CardRail, WeeklyWindow } from "./weekly-card";

const FACE_TONE = {
  lav: { bg: "bg-[var(--tv-lav)]", ring: "ring-[var(--tv-lav)]" },
  butter: { bg: "bg-[var(--tv-butter)]", ring: "ring-[var(--tv-butter)]" },
  mint: { bg: "bg-[var(--tv-mint)]", ring: "ring-[var(--tv-mint)]" },
} as const;

function MeetingCard({
  tone,
  kind,
  joke,
  faces,
  line,
  lineWho,
  children,
}: {
  tone: keyof typeof FACE_TONE;
  kind: string;
  joke: string;
  faces: Person[];
  line: string;
  lineWho: Person;
  children: ReactNode;
}) {
  const name = usePersonName();
  return (
    <article className={cn("relative flex flex-col bg-white", RADIUS.card, SHADOW.panel)}>
      <header
        className={cn(
          "relative rounded-t-[24px] px-5 pt-5 pb-5 lg:rounded-t-[28px]",
          FACE_TONE[tone].bg
        )}
      >
        <h3 className={CARD_TITLE}>{kind}</h3>
        <Hand aria-hidden={false} className="relative mt-1 block w-fit text-[15px]">
          {joke}
          <Scribble
            kind="underline"
            draw="reveal"
            delay={250}
            className="absolute -bottom-2 left-0 h-2.5 w-full"
          />
        </Hand>
        <div className="mt-6 flex items-end gap-2">
          <FacePile names={faces} size={32} ring={FACE_TONE[tone].ring} />
          <p className="m-0 max-w-[200px] rounded-[16px] rounded-bl-[4px] bg-white px-3 py-1.5 text-[13.5px] leading-[1.4] font-bold text-[var(--tv-ink)]">
            <span className="sr-only">{name(lineWho)}: </span>
            {line}
          </p>
        </div>
      </header>
      <MiniBar status="ended" tab="summary" />
      {children}
    </article>
  );
}

function DocSection({
  title,
  count,
  empty,
  className,
  children,
}: {
  title: string;
  count: number;
  empty?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={className}>
      <SectionHead title={title} count={count} />
      {empty ? (
        <p className={cn("m-0 mt-2 border-t py-2.5 text-[13px]", APP.lineSoft, APP.muted)}>
          {empty}
        </p>
      ) : (
        <div className={cn("mt-2 border-t", APP.lineSoft)}>{children}</div>
      )}
    </div>
  );
}

const BODY_X = "px-4 sm:px-5";

function KickoffCard() {
  const t = useTranslations("landing.meetings");
  const decisions = t.raw("kickoff.decisions") as string[];
  const tasks = t.raw("kickoff.tasks") as string[];
  return (
    <MeetingCard
      tone="lav"
      kind={t("kickoff.kind")}
      joke={t("kickoff.joke")}
      faces={["minseo", "seoyeon", "woojae", "jihoon"]}
      line={t("kickoff.line")}
      lineWho="jihoon"
    >
      <div className={cn("relative pt-4 pb-5", BODY_X)}>
        <ReviewHead
          state="confirmed"
          title={t("kickoff.title")}
          chips={
            <>
              <HeadChip icon="date">{t("kickoff.date")}</HeadChip>
              <HeadChip icon="length">{t("kickoff.length")}</HeadChip>
              <FacesChip names={["minseo", "jihoon", "seoyeon", "woojae"]} />
              <HeadChip icon="project">{t("kickoff.project")}</HeadChip>
            </>
          }
        />
        <Scribble
          kind="circle"
          draw="reveal"
          delay={350}
          className="absolute top-[13px] left-[5px] h-[38px] w-[70px] sm:left-[9px]"
        />
        <Sticky
          tone="pop"
          size="sm"
          tilt={4}
          anim="reveal"
          delay={700}
          className="absolute top-[15px] left-[90px] sm:left-[94px]"
        >
          {t("kickoff.after")}
        </Sticky>

        <DocSection title={t("sections.decisions")} count={2} className="mt-6">
          <DecisionRow text={decisions[0]} at="00:00" />
          <DecisionRow text={decisions[1]} at="00:14" />
        </DocSection>
        <DocSection title={t("sections.tasks")} count={2} className="mt-7">
          <TaskRow
            text={tasks[0]}
            who={{ name: "woojae" }}
            due={t("kickoff.due")}
            editable={false}
          />
          <TaskRow
            text={tasks[1]}
            who={{ name: "jihoon" }}
            due={null}
            editable={false}
          />
        </DocSection>
      </div>
    </MeetingCard>
  );
}

function MentoringCard() {
  const t = useTranslations("landing.meetings");
  const tasks = t.raw("mentoring.tasks") as string[];
  const dues = t.raw("mentoring.dues") as string[];
  return (
    <MeetingCard
      tone="butter"
      kind={t("mentoring.kind")}
      joke={t("mentoring.joke")}
      faces={["taeyun", "seojin"]}
      line={t("mentoring.line")}
      lineWho="seojin"
    >
      <div className={cn("relative pt-4 pb-12", BODY_X)}>
        <ReviewHead
          state="review"
          title={t("mentoring.title")}
          chips={
            <>
              <HeadChip icon="date">{t("mentoring.date")}</HeadChip>
              <HeadChip icon="length">{t("mentoring.length")}</HeadChip>
              <FacesChip names={["seojin", "taeyun"]} />
              <HeadChip icon="project">{t("mentoring.project")}</HeadChip>
            </>
          }
        />
        <DocSection
          title={t("sections.decisions")}
          count={0}
          empty={t("mentoring.empty")}
          className="mt-6"
        />
        <DocSection title={t("sections.tasks")} count={3} className="mt-7">
          <TaskRow text={tasks[0]} who={{ name: "taeyun" }} due={dues[0]} />
          <TaskRow text={tasks[1]} who={{ name: "seojin" }} due={dues[1]} />
          <TaskRow text={tasks[2]} who={{ name: "taeyun" }} due={null} />
        </DocSection>
      </div>
      <Sticky
        tone="pop"
        size="sm"
        tilt={-3}
        anim="reveal"
        delay={800}
        className="absolute -bottom-6 left-3 z-10 lg:-left-2"
      >
        {t.rich("mentoring.note", RICH)}
      </Sticky>
      <Scribble
        kind="arrow"
        draw="reveal"
        delay={1000}
        className="absolute bottom-[22px] left-[120px] z-10 h-[38px] w-[60px]"
      />
    </MeetingCard>
  );
}

function WeeklyCard() {
  const t = useTranslations("landing.meetings");
  return (
    <MeetingCard
      tone="mint"
      kind={t("weekly.kind")}
      joke={t("weekly.joke")}
      faces={["harin", "daon", "jiho"]}
      line={t("weekly.line")}
      lineWho="jiho"
    >
      <WeeklyWindow />
    </MeetingCard>
  );
}

function Slot({
  i,
  tilt,
  drop,
  land,
  children,
}: {
  i: number;
  tilt: string;
  drop: string;
  land: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Reveal
      className={cn(
        "tv-land w-[calc(100%-16px)] max-w-[360px] shrink-0 snap-start lg:w-auto lg:max-w-none",
        drop
      )}
      style={land}
    >
      <div className="tv-r" style={vars({ "--i": i })}>
        <div className="tv-swing relative" style={vars({ "--tilt": tilt })}>
          {children}
        </div>
      </div>
    </Reveal>
  );
}

export function MeetingCards() {
  const t = useTranslations("landing.meetings");
  return (
    <section
      id="meetings"
      aria-labelledby="meetings-title"
      className={cn("bg-white", SECTION_Y.white, "pb-2 lg:pb-24")}
    >
      <div className={CONTAINER}>
        <Reveal className="relative">
          <div className="tv-r">
            <h2 id="meetings-title" className={H2}>
              {t.rich("title", {
                m: (chunks) => <span className={MARKER_REVEAL}>{chunks}</span>,
              })}
            </h2>
            <div className="mt-5 flex justify-end lg:hidden">
              <Sticky tone="pop" size="sm" tilt={3}>
                {t("swipe")}
              </Sticky>
            </div>
          </div>
          <span
            aria-hidden
            className="pointer-events-none absolute right-6 bottom-1 hidden items-end gap-1.5 lg:flex"
          >
            <Hand className="text-right text-[15px]">
              {t.rich("summaryNote", RICH)}
            </Hand>
            <Scribble
              kind="arrow-down"
              draw="reveal"
              delay={800}
              className="h-[52px] w-7 translate-y-9"
            />
          </span>
        </Reveal>

        <CardRail
          label={t("railLabel")}
          className={cn(
            "-mx-5 mt-3 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pt-3 pb-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "lg:mx-0 lg:mt-12 lg:grid lg:snap-none lg:grid-cols-3 lg:items-start lg:gap-6 lg:overflow-visible lg:px-0 lg:pt-0 lg:pb-0",
            FOCUS,
            "focus-visible:outline-offset-[-3px]"
          )}
        >
          <Slot
            i={0}
            tilt="-1.5deg"
            drop="lg:mt-0"
            land={vars({
              "--fx": "120px",
              "--fy": "140px",
              "--fr": "-8deg",
              "--ty": "-10px",
            })}
          >
            <KickoffCard />
          </Slot>
          <Slot
            i={1}
            tilt="1deg"
            drop="lg:mt-10"
            land={vars({ "--fy": "240px", "--fr": "2deg", "--ty": "-70px" })}
          >
            <MentoringCard />
          </Slot>
          <Slot
            i={2}
            tilt="-0.6deg"
            drop="lg:mt-5"
            land={vars({
              "--fx": "-120px",
              "--fy": "190px",
              "--fr": "7deg",
              "--ty": "-35px",
            })}
          >
            <WeeklyCard />
          </Slot>
        </CardRail>
      </div>
    </section>
  );
}
