"use client";

import { DoorOpen, Pause, Play, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { ComponentType } from "react";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { localePath } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

import { BODY, FOCUS, H2, MARKER_REVEAL, vars } from "./tokens";

/**
 * 로고 출처(`public/landing/logos/`, 원색판): Zoom 은 selfh.st icons(CC BY 4.0), Webex 는 homarr-labs dashboard-icons
 * (Apache-2.0), 나머지는 theSVG(MIT)입니다. Microsoft Teams · Slack 은 공개 전에 각 사 로고 사용 지침을 확인합니다.
 *
 * 모듈로 import 하지 않고 경로로 두는 것은 `*.svg` 타입 선언이 빌드가 만드는 `next-env.d.ts` 에만 있어서입니다 —
 * 빌드 전 `pnpm typecheck` 가 깨집니다.
 */
const LOGO = {
  zoom: "/landing/logos/zoom.svg",
  googlemeet: "/landing/logos/google-meet.svg",
  microsoftteams: "/landing/logos/microsoft-teams.svg",
  webex: "/landing/logos/webex.svg",
  slack: "/landing/logos/slack.svg",
  discord: "/landing/logos/discord.svg",
} as const;

type Tone = "white" | "butter" | "mint" | "peach";

const TILE: Record<Tone, string> = {
  white: "bg-white",
  butter: "bg-[var(--tv-butter)]",
  mint: "bg-[var(--tv-mint)]",
  peach: "bg-[var(--tv-peach)]",
};

type App = {
  id:
    | "zoom"
    | "meet"
    | "teams"
    | "webex"
    | "slack"
    | "discord"
    | "room"
    | "other";
  logo?: keyof typeof LOGO;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone: Tone;
  other?: true;
};

const ROW_A: App[] = [
  {
    id: "zoom",
    logo: "zoom",
    tone: "white",
  },
  {
    id: "meet",
    logo: "googlemeet",
    tone: "white",
  },
  {
    id: "teams",
    logo: "microsoftteams",
    tone: "white",
  },
  {
    id: "webex",
    logo: "webex",
    tone: "white",
  },
];

const ROW_B: App[] = [
  {
    id: "slack",
    logo: "slack",
    tone: "white",
  },
  {
    id: "discord",
    logo: "discord",
    tone: "white",
  },
  {
    id: "room",
    icon: DoorOpen,
    tone: "butter",
  },
  {
    id: "other",
    icon: Plus,
    tone: "white",
    other: true,
  },
];

function AppCard({ app }: { app: App }) {
  const t = useTranslations("landing.worksWith.apps");
  const Icon = app.icon;
  return (
    <li className="flex w-[272px] shrink-0 sm:w-[340px] lg:w-[380px]">
      <div
        className={cn(
          "flex w-full items-start gap-3.5 rounded-[24px] p-4 sm:gap-4 sm:p-5",
          app.other
            ? "border-2 border-dashed border-[var(--tv-rule-strong)] bg-white"
            : "bg-[var(--tv-lav-soft)]"
        )}
      >
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-[14px] sm:size-12",
            !app.logo && TILE[app.tone]
          )}
        >
          {app.logo ? (
            <Image
              src={LOGO[app.logo]}
              alt=""
              width={44}
              height={44}
              unoptimized
              className="size-10 object-contain sm:size-11"
            />
          ) : Icon ? (
            <Icon aria-hidden className="size-[22px] text-[var(--tv-ink)]" />
          ) : null}
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[19px] leading-tight font-extrabold tracking-[-0.03em] text-[var(--tv-ink)] lg:text-[22px]">
            {t(`${app.id}.name`)}
          </p>
          <p className="m-0 mt-1.5 text-[13px] leading-[1.6] text-[var(--tv-body)] lg:text-[14px]">
            {t(`${app.id}.line`)}
          </p>
        </div>
      </div>
    </li>
  );
}

function Row({
  apps,
  dir,
  dur,
  i,
}: {
  apps: App[];
  dir: "left" | "right";
  dur: string;
  i: number;
}) {
  return (
    <div className="tv-r tv-fade overflow-hidden" style={vars({ "--i": i })}>
      <div
        className="tv-marquee flex w-max"
        data-dir={dir}
        style={vars({ "--dur": dur })}
      >
        {[0, 1, 2].map((copy) => (
          <ul
            key={copy}
            aria-hidden={copy > 0 || undefined}
            className={cn(
              "tv-marquee-set m-0 flex shrink-0 list-none gap-4 p-0 pr-4",
              copy > 0 && "tv-marquee-dup"
            )}
          >
            {apps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

function Listening() {
  const t = useTranslations("landing.worksWith");
  return (
    <span
      aria-hidden
      className="tv-rpop pointer-events-none absolute inset-x-0 top-1/2 z-10 mx-auto flex h-11 w-max -translate-y-1/2 items-center gap-2 rounded-full bg-[var(--tv-ink)] pr-4 pl-1.5 text-[14px] font-bold whitespace-nowrap text-white shadow-[0_10px_24px_-10px_rgba(28,24,69,0.6)] motion-reduce:hidden"
      style={vars({ "--d": "500ms" })}
    >
      <Image
        src="/apple-touch-icon.png"
        alt=""
        width={32}
        height={32}
        className="size-8 rounded-full bg-white object-contain"
      />
      HeyMoa
      <span className="ml-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/85">
        <span className="tv-blink size-2 rounded-full bg-[var(--el-error)]" />
        {t("recording")}
      </span>
      <span className="ml-0.5 flex h-4 items-center gap-[3px]">
        {[0, 1, 2, 3].map((n) => (
          <span
            key={n}
            className="tv-level h-full w-[3px] rounded-full bg-[var(--tv-pop)]"
            style={vars({ "--i": n })}
          />
        ))}
      </span>
    </span>
  );
}

export function WorksWith() {
  const t = useTranslations("landing.worksWith");
  const locale = useLocale();
  const [paused, setPaused] = useState(false);
  const PlayIcon = paused ? Play : Pause;

  return (
    <section
      aria-labelledby="works-title"
      className="bg-white pt-16 pb-6 lg:pt-24 lg:pb-0"
    >
      <Reveal className="tv-band" data-paused={paused || undefined}>
        <div className="mx-auto w-full max-w-[760px] px-5 text-center">
          <h2 id="works-title" className={cn("tv-r", H2, "lg:text-[36px]")}>
            {t.rich("title", {
              m: (chunks) => (
                <span className={cn(MARKER_REVEAL, "whitespace-nowrap")}>
                  {chunks}
                </span>
              ),
            })}
          </h2>
          <p
            className={cn(
              "tv-r",
              BODY,
              "mt-3 text-balance lg:mt-4 lg:text-[17px]"
            )}
            style={vars({ "--i": 1 })}
          >
            {t.rich("body", {
              link: (chunks) => (
                <Link
                  href={localePath(locale, "/download")}
                  className={cn(
                    "rounded-[4px] font-bold text-[var(--tv-ink)] underline decoration-[var(--tv-pop)] decoration-[3px] underline-offset-[5px] transition-colors hover:decoration-[var(--tv-brand)]",
                    FOCUS
                  )}
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>

        <div className="relative mt-8 flex flex-col gap-5 lg:mt-12">
          <Row apps={ROW_A} dir="left" dur="52s" i={2} />
          <Row apps={ROW_B} dir="right" dur="44s" i={3} />
          <Listening />
        </div>

        <div className="mx-auto mt-4 flex w-full max-w-[1120px] justify-end px-5 lg:px-10">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className={cn(
              "relative inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-white pr-3.5 pl-3 text-[13px] font-bold text-[var(--tv-ink)] shadow-[0_2px_6px_-2px_rgba(28,24,69,0.3)] transition-colors before:absolute before:-inset-1 before:rounded-full hover:bg-[var(--tv-butter-soft)] motion-reduce:hidden",
              FOCUS
            )}
          >
            <PlayIcon aria-hidden className="size-4" />
            {paused ? t("play") : t("pause")}
          </button>
        </div>
      </Reveal>
    </section>
  );
}
