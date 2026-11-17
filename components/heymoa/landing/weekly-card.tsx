"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import {
  CHOICE,
  ChoiceCheck,
  ConfirmBar,
  DecisionRow,
  FacesChip,
  HeadChip,
  ReplacementRow,
  ReviewHead,
  SectionHead,
  TaskRow,
} from "./app";
import { useOnceInView, useReducedMotion } from "./hooks";
import { Cursor, Hand, Scribble, Sticky } from "./marks";
import { RICH } from "./rich";
import { APP, FOCUS, vars } from "./tokens";

type Choice = "change" | "keep";

const OPTIONS: readonly Choice[] = ["change", "keep"];

const BEATS = [2000, 2150, 2600, 3000, 5400] as const;

const BAR_AT = {
  pill: "hidden min-[380px]:max-lg:flex min-[1100px]:flex",
  plate: "hidden max-[380px]:flex lg:max-[1100px]:flex",
} as const;

const ARROW_STEP: Partial<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

export function WeeklyWindow() {
  const t = useTranslations("landing.weekly");
  const tm = useTranslations("landing.meetings.sections");
  const [picked, setPicked] = useState<Choice | null>(null);
  const [beat, setBeat] = useState(0);
  const [attach, seen] = useOnceInView<HTMLDivElement>({ threshold: 0.9 });
  const reduced = useReducedMotion();
  const radios = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!seen || reduced || picked) return;
    const timers = BEATS.map((at, i) => window.setTimeout(() => setBeat(i + 1), at));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [seen, reduced, picked]);

  const toggle = picked ?? (reduced || beat >= 3 ? "change" : null);
  const bar = picked ?? (reduced || beat >= 4 ? "change" : null);
  const cursor = !picked && !reduced && beat >= 1 && beat < 5;

  const onRadioKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = ARROW_STEP[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + OPTIONS.length) % OPTIONS.length;
    setPicked(OPTIONS[next]);
    radios.current[next]?.focus();
  };
  const stop = toggle ?? OPTIONS[0];

  return (
    <>
      <div className="relative px-4 pt-4 pb-5 sm:px-5">
        <ReviewHead
          state="review"
          title={t("title")}
          chips={
            <>
              <HeadChip icon="date">{t("date")}</HeadChip>
              <HeadChip icon="length">{t("length")}</HeadChip>
              <FacesChip names={["harin", "jiho", "daon"]} />
              <HeadChip icon="project">{t("project")}</HeadChip>
            </>
          }
        />

        <div className="mt-6">
          <SectionHead title={tm("decisions")} count={1} />
          <div className={cn("mt-2 border-t", APP.lineSoft)}>
            <DecisionRow
              text={t("decision")}
              at="09:32"
              suggestions={
                <ReplacementRow
                  className="relative"
                  target={t("target")}
                  meta={t("meta")}
                  reason={t("reason")}
                  toggle={
                    <>
                      <span role="radiogroup" aria-label={t("groupLabel")} className={CHOICE.group}>
                        {OPTIONS.map((value, index) => {
                          const on = toggle === value;
                          return (
                            <button
                              key={value}
                              ref={(el) => {
                                radios.current[index] = el;
                              }}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              tabIndex={value === stop ? 0 : -1}
                              onClick={() => setPicked(value)}
                              onKeyDown={(event) => onRadioKey(event, index)}
                              className={cn(
                                CHOICE.option,
                                "relative cursor-pointer transition-colors before:absolute before:inset-x-0 before:-inset-y-[11px] before:content-['']",
                                on
                                  ? value === "change"
                                    ? CHOICE.changeOn
                                    : CHOICE.keepOn
                                  : "text-[var(--el-body)] hover:text-[var(--el-ink)]",
                                FOCUS
                              )}
                            >
                              {on && value === "change" ? <ChoiceCheck /> : null}
                              {t(`options.${value}`)}
                              {value === "change" && cursor ? (
                                <Cursor press={beat >= 2} className="top-[40%] left-[45%]" />
                              ) : null}
                            </button>
                          );
                        })}
                      </span>
                      <span
                        aria-hidden
                        className="pointer-events-none absolute top-[44px] left-full ml-7 hidden w-max flex-col xl:flex"
                      >
                        <Scribble kind="arrow" flipX draw="reveal" delay={900} className="h-6 w-10" />
                        <Hand className="-mt-0.5 text-[13px]">{t.rich("dateNote", RICH)}</Hand>
                      </span>
                    </>
                  }
                />
              }
            />
          </div>
        </div>

        <div className="mt-7">
          <SectionHead title={tm("tasks")} count={1} />
          <div className={cn("mt-2 border-t", APP.lineSoft)}>
            <TaskRow
              text={t("task")}
              who={{ name: "harin" }}
              due={t("due")}
            />
          </div>
        </div>
      </div>

      <div ref={attach} className="px-4 pb-7 sm:px-5">
        {(["pill", "plate"] as const).map((variant) => (
          <ConfirmBar
            key={variant}
            variant={variant}
            state={
              bar === null
                ? { kind: "unchosen", n: 1 }
                : { kind: "ready", decisions: 1, tasks: 1, ended: bar === "change" ? 1 : undefined }
            }
            buttonSlot={
              bar === null ? null : (
                <span
                  key={bar}
                  aria-hidden
                  className="tv-ring pointer-events-none absolute inset-0 rounded-[inherit]"
                  style={vars({ "--n": 2 })}
                />
              )
            }
            className={cn(
              BAR_AT[variant],
              "[&>[aria-hidden]]:hidden [&>span:first-child]:text-balance",
              bar === null && "[&>span:last-child]:opacity-65"
            )}
          />
        ))}
      </div>

      <Sticky
        key={bar === null ? "before" : "after"}
        tone="pop"
        size="sm"
        tilt={-3}
        anim={bar === null ? "reveal" : "pop"}
        delay={bar === null ? 900 : 0}
        className="absolute right-3 -bottom-12 z-10 lg:-right-6"
      >
        {t.rich(bar === null ? "before" : "after", RICH)}
      </Sticky>
    </>
  );
}

const WIDE = "(min-width: 1024px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function CardRail({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false
  );
  return (
    <div
      role={wide ? undefined : "region"}
      aria-label={wide ? undefined : label}
      tabIndex={wide ? undefined : 0}
      className={className}
    >
      {children}
    </div>
  );
}
