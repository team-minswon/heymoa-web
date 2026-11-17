import { useMessages, useTranslations } from "next-intl";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { cn } from "@/lib/utils";

import { AskChat } from "./ask-chat";
import { Hand, Scribble, Sticky } from "./marks";
import { RICH } from "./rich";
import { CONTAINER, H2, LEAD, MARKER_REVEAL, SECTION_Y, vars } from "./tokens";

const WALL = [
  {
    tone: "pop",
    tilt: -4,
    big: true,
    shift: "lg:-translate-y-1",
    land: {
      "--fx": "-220px",
      "--fy": "50px",
      "--fr": "-14deg",
      "--ty": "-24px",
      "--tr": "-5deg",
    },
  },
  {
    tone: "white",
    tilt: 3,
    big: false,
    shift: "lg:translate-y-3",
    land: {
      "--fx": "-80px",
      "--fy": "110px",
      "--fr": "10deg",
      "--ty": "-60px",
      "--tr": "4deg",
    },
  },
  {
    tone: "mint",
    tilt: -2,
    big: false,
    shift: "lg:-translate-y-2",
    land: {
      "--fx": "80px",
      "--fy": "90px",
      "--fr": "-11deg",
      "--ty": "-44px",
      "--tr": "-4deg",
    },
  },
  {
    tone: "butter",
    tilt: 4,
    big: true,
    shift: "lg:translate-y-2",
    land: {
      "--fx": "220px",
      "--fy": "40px",
      "--fr": "14deg",
      "--ty": "-16px",
      "--tr": "6deg",
    },
  },
] as const;

export function Ask() {
  const t = useTranslations("landing.ask");
  const wall = useMessages().landing.ask.wall;
  return (
    <section
      id="ask"
      aria-labelledby="ask-title"
      className={`bg-[var(--tv-lav)] ${SECTION_Y.color}`}
    >
      <Reveal aria-hidden className={CONTAINER}>
        <ul className="m-0 grid list-none grid-cols-2 items-center gap-x-3 gap-y-5 p-0 lg:flex lg:flex-wrap lg:justify-center lg:gap-x-6 lg:gap-y-4">
          {WALL.map((line, i) => (
            <li
              key={line.tone}
              className={cn("tv-land flex justify-center", line.shift)}
              style={vars(line.land)}
            >
              <Sticky
                tone={line.tone}
                tilt={line.tilt}
                size="sm"
                anim="reveal"
                delay={i * 120}
                className={cn(
                  "text-[14px]",
                  line.big
                    ? "lg:px-4 lg:py-2.5 lg:text-[18px]"
                    : "lg:text-[15px]"
                )}
              >
                {wall[i]}
              </Sticky>
            </li>
          ))}
        </ul>
        <div className="mt-7 flex justify-center lg:mt-9 lg:grid lg:grid-cols-[minmax(0,1fr)_540px] lg:gap-16">
          <div className="flex flex-col items-center gap-1 lg:col-start-2 lg:pl-24">
            <Hand className="text-[16px]">{t("hand")}</Hand>
            <Scribble
              kind="arrow-down"
              draw="reveal"
              delay={600}
              className="lg:-rotate-[18deg]"
            />
          </div>
        </div>
      </Reveal>

      <AskChat
        heading={
          <Reveal>
            <h2 id="ask-title" className={H2}>
              {t.rich("title", {
                ...RICH,
                mark: (chunks) => (
                  <span className={cn(MARKER_REVEAL, "whitespace-nowrap")}>
                    {chunks}
                  </span>
                ),
              })}
            </h2>
            <p className={`${LEAD} mt-4`}>{t("lead")}</p>
          </Reveal>
        }
      />
    </section>
  );
}
