import { Scissors } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { cn } from "@/lib/utils";

import {
  AppWindow,
  ConfirmBar,
  DecisionRow,
  EvidenceQuotes,
  FacesChip,
  HeadChip,
  MiniBar,
  type Person,
  ReviewHead,
  RowActions,
  ScriptRow,
  SectionHead,
  TaskRow,
} from "./app";
import { Cursor, Hand, Scribble, Sticky, Tape } from "./marks";
import { RICH } from "./rich";
import {
  CAPTION,
  CONTAINER,
  H2,
  LEAD,
  MARKER_REVEAL,
  SECTION_Y,
  SHADOW,
  vars,
} from "./tokens";

type Line = {
  at: string;
  who: Person;
  before: string;
  mark: string;
  after: string;
};

const SPOTS: ReadonlyArray<Pick<Line, "at" | "who">> = [
  { at: "00:00", who: "minseo" },
  { at: "00:14", who: "jihoon" },
  { at: "01:02", who: "woojae" },
  { at: "01:19", who: "jihoon" },
];

function useLines(): Line[] {
  const t = useTranslations("landing.evidence");
  const text = t.raw("lines") as Array<Pick<Line, "before" | "mark" | "after">>;
  return SPOTS.map((spot, k) => ({ ...spot, ...text[k] }));
}

const pairAt = (k: number) => 700 + k * 260;

function Pen({ d, children }: { d: number; children: ReactNode }) {
  return (
    <span
      className="tv-rmark bg-[linear-gradient(var(--el-highlight),var(--el-highlight))] bg-no-repeat [background-position:0_100%] [background-size:100%_0.66em] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
      style={vars({ "--d": `${d}ms` })}
    >
      {children}
    </span>
  );
}

function Tag({
  n,
  side,
  row,
  d,
}: {
  n: number;
  side: "left" | "right";
  row: "script" | "review";
  d: number;
}) {
  const t = useTranslations("landing.evidence");
  return (
    <span
      aria-hidden
      className={cn(
        "tv-rpop pointer-events-none absolute z-10 flex flex-col items-center",
        side === "left"
          ? "right-[calc(100%_+_9px)] lg:right-[calc(100%_+_6px)]"
          : "left-[calc(100%_+_9px)] lg:left-[calc(100%_+_6px)]",
        row === "script" ? "top-[15px] lg:top-3" : "top-3 lg:top-[9px]"
      )}
      style={vars({ "--d": `${d}ms` })}
    >
      <span
        className={cn(
          "flex size-[22px] items-center justify-center rounded-full bg-[var(--tv-pop)] text-[11.5px] font-extrabold tabular-nums text-[var(--tv-ink)] lg:h-7 lg:w-auto lg:rounded-[6px] lg:px-2 lg:text-[12px]",
          SHADOW.sticky
        )}
      >
        <span className="hidden whitespace-pre lg:inline">{t("tag")}</span>
        {n}
      </span>
      <span className="hidden size-0 border-x-[6px] border-t-[6px] border-x-transparent border-t-[var(--tv-pop)] lg:block" />
    </span>
  );
}

function ScriptWindow() {
  const t = useTranslations("landing");
  const lines = useLines();
  return (
    <AppWindow
      className="tv-swing overflow-visible"
      style={vars({ "--tilt": "-1.5deg" })}
    >
      <MiniBar
        status="ended"
        tab="script"
        size="md"
        title={
          <span className="hidden sm:inline">
            {t("meetings.kickoff.title")}
          </span>
        }
      />
      <ol className="m-0 list-none px-5 pb-3 lg:[zoom:1.04]">
        {lines.map((line, k) => (
          <ScriptLi key={line.at} line={line} k={k} />
        ))}
      </ol>
      <Tape className="absolute right-3 -bottom-6 h-7 gap-1.5 text-[12px] sm:right-5 sm:text-[13px]">
        <Scissors aria-hidden className="size-3.5 shrink-0" />
        {t("evidence.tape")}
      </Tape>
    </AppWindow>
  );
}

function ScriptLi({ line, k }: { line: Line; k: number }) {
  return (
    <li className="relative">
      <ScriptRow
        at={line.at}
        speaker={{ name: line.who }}
        className="grid-cols-[40px_minmax(0,1fr)] gap-3 py-3.5 sm:grid-cols-[52px_minmax(0,1fr)] sm:gap-4"
      >
        {line.before}
        <Pen d={pairAt(k)}>{line.mark}</Pen>
        {line.after}
      </ScriptRow>
      <Tag n={k + 1} side="left" row="script" d={pairAt(k) + 80} />
    </li>
  );
}

function ButtonNotes() {
  const t = useTranslations("landing.evidence");
  return (
    <>
      <span
        aria-hidden
        className="tv-rslide pointer-events-none absolute inset-0"
        style={vars({ "--d": "1900ms" })}
      >
        <Cursor className="top-[68%] left-[76%]" />
      </span>
      <Scribble
        kind="arrow-down"
        rotate={180}
        draw="reveal"
        delay={1700}
        className="absolute top-[calc(100%_+_6px)] left-1/2 -translate-x-1/2"
      />
      <Sticky
        tone="pop"
        size="lg"
        tilt={-4}
        anim="reveal"
        delay={1850}
        className="absolute top-[calc(100%_+_62px)] left-1/2 -translate-x-1/2 whitespace-nowrap"
      >
        {t("press")}
      </Sticky>
      <span
        className="tv-rpop absolute top-[calc(100%_+_118px)] right-[calc(100%_-_24px)] lg:top-[calc(100%_+_68px)] lg:right-[calc(50%_+_72px)]"
        style={vars({ "--d": "2050ms" })}
      >
        <Hand className="whitespace-nowrap">{t.rich("dialog", RICH)}</Hand>
      </span>
    </>
  );
}

function PairNote() {
  const t = useTranslations("landing.evidence");
  return (
    <span
      aria-hidden
      className="tv-rpop pointer-events-none absolute top-[calc(50%_-_10px)] right-[calc(100%_+_26px)] hidden h-20 w-[84px] lg:block"
      style={vars({ "--d": "450ms" })}
    >
      <Hand className="absolute top-0 right-0 whitespace-nowrap">
        {t("pairDecision")}
      </Hand>
      <Scribble
        kind="arrow"
        draw="reveal"
        delay={550}
        className="absolute top-[14px] left-[14px] h-10 w-[60px]"
      />
      <Hand className="absolute bottom-0 left-0 whitespace-nowrap">
        {t("pairLine")}
      </Hand>
    </span>
  );
}

function SummaryWindow() {
  const t = useTranslations("landing");
  const lines = useLines();
  const quoted = lines[1];
  const decisions = t.raw("meetings.kickoff.decisions") as string[];
  const tasks = t.raw("meetings.kickoff.tasks") as string[];
  return (
    <div className="tv-swing" style={vars({ "--tilt": "1deg" })}>
      <AppWindow className="overflow-visible">
        <MiniBar
          status="ended"
          tab="summary"
          size="md"
          title={
            <span className="hidden sm:inline">
              {t("meetings.kickoff.title")}
            </span>
          }
        />
        <div className="relative px-5 pt-5 pb-10 max-[360px]:pb-5 lg:[zoom:1.04]">
          <Scribble
            kind="circle"
            draw="reveal"
            delay={300}
            className="absolute top-[17px] left-[8px] h-[38px] w-[74px]"
          />
          <Sticky
            tone="pop"
            size="sm"
            tilt={4}
            anim="reveal"
            delay={600}
            className="absolute top-[19px] left-[98px] whitespace-nowrap"
          >
            {t("evidence.before")}
          </Sticky>
          <ReviewHead
            state="review"
            title={t("meetings.kickoff.title")}
            chips={
              <>
                <HeadChip icon="date">{t("meetings.kickoff.date")}</HeadChip>
                <HeadChip icon="length">
                  {t("meetings.kickoff.length")}
                </HeadChip>
                <FacesChip names={["minseo", "jihoon", "seoyeon", "woojae"]} />
              </>
            }
          />
          <SectionHead
            title={t("meetings.sections.decisions")}
            count={2}
            className="mt-7"
          />
          <div className="mt-2">
            <div className="relative">
              <DecisionRow
                text={decisions[0]}
                topic={t("meetings.kickoff.topic")}
                at="00:00"
              />
              <Tag n={1} side="right" row="review" d={pairAt(0) + 160} />
              <PairNote />
            </div>
            <div className="relative">
              <DecisionRow
                text={decisions[1]}
                topic={t("meetings.kickoff.topic")}
                at="00:14"
                open
              >
                <EvidenceQuotes
                  className="sm:mr-4"
                  quotes={[
                    {
                      who: lines[0].who,
                      at: lines[0].at,
                      text: `${lines[0].before}${lines[0].mark}${lines[0].after}`,
                      cited: false,
                    },
                    {
                      who: quoted.who,
                      at: quoted.at,
                      text: (
                        <>
                          {quoted.before}
                          <Pen d={pairAt(1) + 160}>{quoted.mark}</Pen>
                          {quoted.after}
                        </>
                      ),
                      cited: true,
                    },
                  ]}
                />
                <div className="mt-2.5">
                  <RowActions />
                </div>
              </DecisionRow>
              <Tag n={2} side="right" row="review" d={pairAt(1) + 160} />
              <span
                aria-hidden
                className="tv-rpop pointer-events-none absolute top-[104px] left-[calc(100%_+_6px)] hidden flex-col items-start min-[1340px]:flex"
                style={vars({ "--d": "1300ms" })}
              >
                <Scribble
                  kind="arrow"
                  flipX
                  rotate={-30}
                  draw="reveal"
                  delay={1350}
                />
                <Hand className="mt-1 ml-5 whitespace-nowrap">
                  {t.rich("evidence.quoteNote", RICH)}
                </Hand>
              </span>
            </div>
          </div>

          <SectionHead
            title={t("meetings.sections.tasks")}
            count={2}
            className="mt-8"
          />
          <div className="mt-2">
            <div className="relative">
              <TaskRow
                text={tasks[0]}
                who={{ name: "woojae" }}
                due={t("meetings.kickoff.due")}
              />
              <Tag n={3} side="right" row="review" d={pairAt(2) + 160} />
            </div>
            <div className="relative">
              <TaskRow text={tasks[1]} who={{ name: "jihoon" }} due={null} />
              <Tag n={4} side="right" row="review" d={pairAt(3) + 160} />
            </div>
          </div>
          <ConfirmBar
            variant="plate"
            state={{ kind: "ready", decisions: 2, tasks: 2 }}
            buttonSlot={<ButtonNotes />}
            className="mt-6 min-[360px]:hidden"
          />
        </div>
      </AppWindow>
      <div className="relative -mt-6 flex justify-center max-[360px]:hidden">
        <ConfirmBar
          variant="pill"
          state={{ kind: "ready", decisions: 2, tasks: 2 }}
          buttonSlot={<ButtonNotes />}
          className="xl:hidden"
        />
        <ConfirmBar
          variant="float"
          state={{ kind: "ready", decisions: 2, tasks: 2 }}
          buttonSlot={<ButtonNotes />}
          className="hidden xl:flex"
        />
      </div>
    </div>
  );
}

export function Evidence() {
  const t = useTranslations("landing.evidence");
  return (
    <section
      id="evidence"
      aria-labelledby="evidence-title"
      className={`bg-[var(--tv-butter)] ${SECTION_Y.color}`}
    >
      <div
        className={cn(
          CONTAINER,
          "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:items-start lg:gap-x-24"
        )}
      >
        <div>
          <Reveal className="grid gap-5 lg:gap-6">
            <h2 id="evidence-title" className={`tv-r ${H2}`}>
              {t.rich("title", {
                m: (chunks) => (
                  <span
                    className={MARKER_REVEAL}
                    style={vars({ "--d": "350ms" })}
                  >
                    {chunks}
                  </span>
                ),
              })}
            </h2>
            <div className="tv-r" style={vars({ "--i": 1 })}>
              <p className={LEAD}>{t("lead")}</p>
            </div>
          </Reveal>

          <Reveal
            className="tv-land mt-12 lg:mt-16"
            style={vars({ "--fx": "-50px", "--fy": "70px", "--fr": "-4deg" })}
          >
            <p className="sr-only">{t("sr")}</p>
            <div className="tv-r relative">
              <ScriptWindow />
              <p className={cn(CAPTION, "mt-11 flex items-start gap-2")}>
                <Scribble
                  kind="arrow"
                  rotate={-50}
                  className="mt-0.5 h-7 w-10"
                />
                {t("caption")}
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal
          className="tv-land mt-6 lg:mt-0"
          style={vars({ "--fy": "170px", "--fr": "3deg", "--ty": "-50px" })}
        >
          <div
            aria-hidden
            className="flex items-center justify-center gap-2 pb-4 lg:hidden"
          >
            <Scribble kind="arrow-down" draw="reveal" delay={500} />
            <Hand>{t("pairs")}</Hand>
          </div>
          <div className="tv-r relative" style={vars({ "--i": 2 })}>
            <SummaryWindow />
            <div
              aria-hidden
              className="h-[168px] max-[360px]:h-[148px] lg:h-[112px]"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
