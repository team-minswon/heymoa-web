import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { LandingCta } from "@/components/heymoa/landing-cta";
import { Reveal } from "@/components/heymoa/landing/reveal";
import { cn } from "@/lib/utils";

import { Face, usePersonName } from "./app";
import { Scribble, Speech } from "./marks";
import { RICH } from "./rich";
import { CLOSING_H, CONTAINER, FOCUS_ON_BRAND, RADIUS, SHADOW, vars } from "./tokens";

const ROSTER = [
  [1, "minseo"],
  [2, "jihoon"],
  [3, "seoyeon"],
  [4, "woojae"],
] as const;

const SCRAWL =
  "tv-rpop m-0 origin-left whitespace-nowrap text-[13px] leading-[1.35] font-extrabold tracking-[-0.01em] text-[var(--tv-brand-deep)] lg:text-[14px]";

function DutyRoster() {
  const t = useTranslations("landing.closing.roster");
  const name = usePersonName();
  return (
    <div
      aria-hidden
      className="tv-rslide tv-land tv-roster absolute -top-10 right-3 w-[170px] lg:-top-12 lg:-right-6 lg:w-[232px]"
      style={{
        rotate: "6deg",
        ...vars({
          "--d": "0ms",
          "--fx": "60px",
          "--fy": "-90px",
          "--fr": "14deg",
        }),
      }}
    >
      <div
        className={`relative rounded-[6px] border-[1.5px] border-[var(--tv-ink)] bg-[linear-gradient(315deg,var(--tv-lav)_0_15px,var(--tv-ink)_15px_16.5px,white_16.5px)] p-3 text-left lg:p-4 ${SHADOW.sticky}`}
      >
        <span className="absolute -top-3 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-[4deg] bg-[var(--tv-pop)]/70" />

        <div className="flex items-center justify-between gap-2 border-b border-[var(--tv-rule)] pb-1.5 lg:pb-2">
          <span className="text-[13.5px] leading-[1.3] font-extrabold whitespace-nowrap text-[var(--tv-ink)] lg:text-[15px]">
            {t("title")}
          </span>
        </div>

        <ul className="m-0 mt-1 list-none p-0 lg:mt-1.5">
          {ROSTER.map(([week, who], i) => (
            <li
              key={who}
              className={cn(
                "flex items-center gap-2 py-1 text-[13px] leading-[1.3] font-bold text-[var(--tv-body)] lg:text-[14px]",
                i > 1 && "hidden lg:flex"
              )}
              style={vars({ "--k": i })}
            >
              <span className="min-w-6 shrink-0 whitespace-nowrap text-[var(--tv-muted)] tabular-nums">
                {t("week", { n: week })}
              </span>
              <Face who={who} size={18} className="shrink-0" />
              <span className="relative whitespace-nowrap">
                {name(who)}
                <Scribble
                  kind="strike"
                  color="ink"
                  draw="reveal"
                  delay={600 + i * 150}
                  className="absolute top-1/2 -left-1 h-[10px] w-[calc(100%+8px)] -translate-y-1/2"
                />
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-1.5 border-t border-dashed border-[var(--tv-rule-strong)] pt-1.5 lg:mt-2 lg:pt-2">
          <p className={SCRAWL} style={vars({ "--d": "1450ms", "--k": 0 })}>
            {t("notes")}
          </p>
          <p className={SCRAWL} style={vars({ "--d": "1650ms", "--k": 1 })}>
            {t("review")}
          </p>
        </div>
      </div>
    </div>
  );
}

function Loop() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 60"
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute -top-[5px] -left-[10px] h-[calc(100%+10px)] w-[calc(100%+20px)] overflow-visible text-[var(--tv-pop)] [stroke-width:5] lg:-top-[6px] lg:-left-[18px] lg:h-[calc(100%+12px)] lg:w-[calc(100%+36px)] lg:[stroke-width:4]"
    >
      <path
        d="M26 7 C70 3, 140 2, 182 6 C196 8, 198 48, 184 53 C140 58, 62 58, 18 54 C4 52, 2 13, 16 8 C34 3, 66 3, 100 5"
        pathLength={1}
        className="tv-rdraw"
        style={{ strokeDasharray: "1 2", ...vars({ "--d": "400ms" }) }}
      />
    </svg>
  );
}

export function Closing() {
  const t = useTranslations("landing.closing");
  return (
    <section className="bg-white pt-16 pb-16 lg:pt-28 lg:pb-24">
      <div className={CONTAINER}>
        <Reveal
          className={`tv-land relative ${RADIUS.face} bg-[var(--tv-brand)] px-6 pt-32 pb-14 text-center md:pt-20 lg:px-16 lg:py-20`}
          style={vars({ "--fy": "100px", "--fs": 0.86 })}
        >
          <DutyRoster />

          <div aria-hidden className="absolute -bottom-5 -left-5 hidden whitespace-nowrap lg:block">
            <Speech who="jihoon" tone="white" tilt={-4} anim="reveal" delay={1900}>
              {t("speech")}
            </Speech>
          </div>

          <div className="flex flex-col items-center">
            <h2
              className={cn(
                CLOSING_H,
                "tv-loop mx-auto max-w-[780px] leading-[1.3] lg:leading-[1.2]"
              )}
            >
              {t.rich("title", {
                ...RICH,
                loop: (chunks: ReactNode) => (
                  <span className="relative mr-1.5 whitespace-nowrap lg:mr-2">
                    {chunks}
                    <Loop />
                  </span>
                ),
              })}
            </h2>
            <p className="m-0 mt-5 max-w-[520px] text-balance text-[16px] leading-[1.75] text-[var(--tv-on-brand)] lg:text-[18px]">
              {t.rich("body", {
                ...RICH,
                br: () => <br className="hidden lg:inline" />,
              })}
            </p>
            <LandingCta
              label={t("cta")}
              className={`mt-8 h-[56px] justify-center gap-2 border-transparent bg-[var(--tv-pop)] px-6 text-[15px] font-extrabold text-[var(--tv-ink)] hover:bg-white focus-visible:border-transparent focus-visible:ring-0 lg:mt-10 lg:px-8 lg:text-[16px] ${FOCUS_ON_BRAND}`}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
