import type { ReactNode } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { localePath } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

import {
  AgendaHead,
  AppWindow,
  DecisionRow,
  MiniBar,
  RowActions,
  SectionHead,
  TimelineList,
  TimelineRow,
} from "./app";
import { Scribble, Speech } from "./marks";
import { RICH } from "./rich";
import {
  APP,
  BODY,
  CONTAINER,
  FOCUS,
  H2,
  HAND,
  MARKER,
  SECTION_Y,
  SHADOW,
  vars,
} from "./tokens";

const LINK = `${HAND} mt-1 inline-flex min-h-11 items-center gap-1 rounded-sm underline decoration-[var(--tv-pop)] decoration-[3px] underline-offset-4 ${FOCUS}`;

const NUM =
  "tv-rmark -mx-1 inline-block bg-[linear-gradient(var(--tv-butter),var(--tv-butter))] bg-no-repeat px-1 text-[30px] leading-none font-extrabold tracking-[-0.04em] text-[var(--tv-ink)] tabular-nums [background-position:0_92%] [background-size:100%_0.42em] group-open:bg-[linear-gradient(var(--tv-pop),var(--tv-pop))] group-hover/sum:bg-[linear-gradient(var(--tv-pop),var(--tv-pop))] lg:text-[38px]";

function SeeLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={LINK}>
      {children}
      <ArrowRight aria-hidden className="size-4 shrink-0" />
    </Link>
  );
}

const SHADOW_NARROW =
  "max-lg:shadow-[0_10px_20px_-10px_rgba(40,24,120,0.3),0_1px_3px_rgba(12,10,9,0.05)]";

function Sample({ children }: { children: ReactNode }) {
  return (
    <div className="relative mt-6 -ml-[48px] max-w-[520px] sm:mx-0 lg:mb-5">
      <AppWindow className={SHADOW_NARROW}>{children}</AppWindow>
    </div>
  );
}

function RetractedSample() {
  const t = useTranslations("landing.faq.retracted");
  return (
    <Sample>
      <MiniBar status="recording" tab="timeline" size="sm" />
      <div className="px-3 pt-2.5 pb-2">
        <AgendaHead
          range={t("range")}
          title={t("agenda")}
          total={2}
          live
          className="h-auto min-h-[30px] [&_.truncate]:leading-5 [&_.truncate]:whitespace-normal max-[360px]:[&>span:first-child]:hidden max-[360px]:[&>span:last-child]:pl-2"
        />
        <TimelineList className="mt-1.5">
          <TimelineRow
            at="10:05"
            tone="decision"
            kind={t("kind")}
            retracted
            title={t("before")}
          />
          <TimelineRow
            at="10:41"
            tone="decision"
            kind={t("kind")}
            title={t("after")}
          />
        </TimelineList>
      </div>
    </Sample>
  );
}

function ExcludedSample() {
  const t = useTranslations("landing.faq.excluded");
  return (
    <Sample>
      <MiniBar status="ended" tab="summary" size="sm" />
      <div className="px-4 pt-3 pb-3">
        <SectionHead title={t("section")} count={1} />
        <DecisionRow text={t("kept")} at="10:41" className="mt-1" />
        <DecisionRow
          text={t("dropped")}
          at="10:58"
          open
          excluded
          className="border-b-0 [&_.line-through]:text-[var(--el-body)]"
        >
          <p className={cn("m-0 text-[12px]", APP.muted)}>{t("note")}</p>
          <RowActions excluded />
        </DecisionRow>
      </div>
    </Sample>
  );
}

const MARK = {
  ...RICH,
  m: (chunks: ReactNode) => <span className={MARKER}>{chunks}</span>,
};

export function useFaqQA(): Array<{
  q: string;
  a: ReactNode;
  more?: ReactNode;
}> {
  const t = useTranslations("landing.faq.items");
  const locale = useLocale();
  const item = (id: "q1" | "q2" | "q3" | "q4" | "q5" | "q6") => ({
    q: t(`${id}.q`),
    a: t.rich(`${id}.a`, MARK),
  });
  return [
    {
      ...item("q1"),
      more: (
        <SeeLink href={localePath(locale, "/download")}>{t("q1.more")}</SeeLink>
      ),
    },
    { ...item("q2"), more: <SeeLink href="#evidence">{t("q2.more")}</SeeLink> },
    { ...item("q3"), more: <RetractedSample /> },
    { ...item("q4"), more: <ExcludedSample /> },
    { ...item("q5"), more: <SeeLink href="#meetings">{t("q5.more")}</SeeLink> },
    item("q6"),
  ];
}

function QMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "tv-rpop grid shrink-0 place-items-center bg-[var(--tv-pop)] font-extrabold text-[var(--tv-ink)]",
        SHADOW.sticky,
        className
      )}
      style={{ rotate: "-6deg" }}
    >
      ?
    </span>
  );
}

export function Faq() {
  const t = useTranslations("landing.faq");
  const qa = useFaqQA();
  return (
    <section
      id="faq"
      className={`bg-[var(--tv-lav-soft)] [interpolate-size:allow-keywords] ${SECTION_Y.color}`}
    >
      <Reveal
        className={`${CONTAINER} grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-16`}
      >
        <div className="self-start lg:sticky lg:top-24">
          <div className="flex items-center gap-4">
            <h2 className={H2}>{t("title")}</h2>
            <QMark className="size-11 rounded-[14px] rounded-bl-[4px] text-[24px] lg:hidden" />
          </div>
          <div aria-hidden className="relative mt-10 hidden lg:block">
            <QMark className="ml-2 size-24 rounded-[26px] rounded-bl-[6px] text-[46px]" />
            <Scribble
              kind="arrow-long"
              rotate={-6}
              draw="reveal"
              delay={250}
              className="absolute top-1 left-[128px]"
            />
          </div>
          <div
            aria-hidden
            className="mt-5 flex flex-col items-start gap-2 lg:mt-12"
          >
            <Speech
              who="seoyeon"
              tone="butter"
              tilt={-2}
              anim="reveal"
              delay={500}
            >
              {t("speech.duty")}
            </Speech>
            <Speech
              who="woojae"
              side="right"
              tone="white"
              size="sm"
              tilt={3}
              anim="reveal"
              delay={1000}
              className="ml-12"
            >
              {t("speech.pointer")}
            </Speech>
          </div>
        </div>

        <div className="border-t border-[var(--tv-rule-strong)]">
          {qa.map(({ q, a, more }, i) => (
            <details
              key={q}
              className="tv-faq group border-b border-[var(--tv-rule-strong)]"
            >
              <summary
                className={`group/sum grid cursor-pointer list-none grid-cols-[48px_minmax(0,1fr)_32px] items-center gap-3 rounded-lg py-5 marker:hidden lg:grid-cols-[64px_minmax(0,1fr)_36px] lg:gap-4 lg:py-6 [&::-webkit-details-marker]:hidden ${FOCUS}`}
              >
                <span aria-hidden className="justify-self-start">
                  <span
                    className={NUM}
                    style={vars({ "--d": `${200 + i * 90}ms` })}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </span>
                <span className="text-[17px] leading-[1.4] font-bold text-[var(--tv-ink)] lg:text-[20px]">
                  {q}
                </span>
                <span
                  aria-hidden
                  className="grid size-8 place-items-center rounded-full bg-[var(--tv-butter)] transition-colors group-open:bg-[var(--tv-pop)] group-hover/sum:bg-[var(--tv-pop)] motion-reduce:transition-none lg:size-9"
                >
                  <ChevronDown className="size-4 text-[var(--tv-ink)] transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                </span>
              </summary>
              <div className="pr-3 pb-7 pl-[60px] lg:pr-12 lg:pl-[80px]">
                <p className={BODY}>{a}</p>
                {more}
              </div>
            </details>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
