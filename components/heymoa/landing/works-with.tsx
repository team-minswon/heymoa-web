"use client";

import { DoorOpen, Pause, Play, Plus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { ComponentType } from "react";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { cn } from "@/lib/utils";

import { BODY, FOCUS, H2, MARKER_REVEAL, vars } from "./tokens";

/**
 * 「어디서 회의하든 켜 두기만」 띠 — FAQ 와 마무리 사이. 히어로 바로 아래에서는 「예시 회의
 * 먼저 보기 ↓」와 회의 카드 사이를 끊고 흰 구간 둘이 같은 제목 꼴로 이어져 애매했다. 마무리(「다음 회의에는
 * 당번표에 HeyMoa를 적어 두세요」) 바로 앞에서 「어디서든 켜 두기만」으로 받쳐 준다. Otter 의 연동 카드 줄을 따라 카드 두 줄이
 * 서로 반대로 흐르고, 가운데에 「HeyMoa · 기록 중」 알약이 떠 있다(어느 회의가 지나가도 듣고 있다는 그림).
 *
 * **연동이 아니다.** HeyMoa 는 회의 앱에 들어가지 않고 브라우저 탭에서 마이크(`getUserMedia`)로 듣는다
 * (`lib/transcription/audio.ts`). 카드 문구는 「봇이 안 낀다 · 연동을 안 건다 · 들리면 받아 적는다」처럼
 * 그 사실 안에서만 말한다. 로고는 원색 그대로다(`public/landing/logos/`) — 처음엔 simple-icons 의 한 색 마크를 브랜드
 * 색으로 칠했는데, Meet · Slack 처럼 여러 색인 로고가 한 색이 되어 진짜 로고로 안 읽혔다. Zoom 은 익숙한
 * 파란 원 · 흰 카메라(selfh.st icons, CC BY 4.0), Webex 는 파랑 · 초록 그러데이션 원색판(homarr-labs
 * dashboard-icons, Apache-2.0), 나머지는 theSVG(MIT)의 현행 원색판이다. Microsoft Teams · Slack 은 공개 전에
 * 각 사 로고 사용 지침을 확인한다. 로고가 없는 네이버웍스 카드는 뺐다.
 *
 * 움직임: 한 줄은 같은 목록을 세 벌 이어 두고 한 벌 폭(트랙의 1/3)만큼 미끄러진 뒤 처음으로 돌아간다 —
 * 두 벌만 두면 2560 폭에서 한 벌(4 × 396 ≈ 1584)이 화면보다 좁아 끝이 빈다. 벌 사이 간격은 벌 자신의
 * 오른쪽 여백(`pr-4`, 카드 사이 gap 과 같다)이라 1/3 이 정확히 한 벌이다. 마우스를 올리거나 포커스가
 * 들어오면 멈추고, 일시정지 버튼(WCAG 2.2.2)은 `data-paused` 로 띠 안의 모든 움직임을 세운다
 * (`motion.tsx`). 모션을 줄이면 흐르지 않고 첫 벌만 가운데 정렬로 접혀 선다(나머지 두 벌은 숨는다).
 */

/**
 * 카드 로고 — `public/landing/logos/` 의 원색 SVG(출처는 머리 주석). 모듈로 import 하지 않고 경로로 두는 것은
 * `*.svg` 타입 선언이 빌드가 만드는 `next-env.d.ts` 에만 있어서다 — 빌드 전 `pnpm typecheck` 가 깨진다.
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
  name: string;
  line: string;
  /** 브랜드 마크. 없으면 `icon`(회의실 · 그 밖의 앱). */
  logo?: keyof typeof LOGO;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone: Tone;
  other?: true;
};

const ROW_A: App[] = [
  {
    name: "Zoom",
    line: "Zoom 회의를 열고 HeyMoa에서 회의를 시작하면 끝. 둘이 서로를 몰라도 돼요.",
    logo: "zoom",
    tone: "white",
  },
  {
    name: "Google Meet",
    line: "Meet 탭 옆에 탭 하나 더. 끝나면 결정과 할 일이 요약 탭에 모여요.",
    logo: "googlemeet",
    tone: "white",
  },
  {
    name: "Microsoft Teams",
    line: "참석자 목록에 낯선 봇이 끼지 않아요. HeyMoa는 회의에 들어가지 않으니까요.",
    logo: "microsoftteams",
    tone: "white",
  },
  {
    name: "Webex",
    line: "회사가 정해 둔 회의 앱이어도 괜찮아요. 관리자에게 연동을 부탁할 일이 없어요.",
    logo: "webex",
    tone: "white",
  },
];

const ROW_B: App[] = [
  {
    name: "Slack 허들",
    line: "잠깐 붙은 허들에서 나온 결정도 흘려보내지 않아요.",
    logo: "slack",
    tone: "white",
  },
  {
    name: "Discord",
    line: "사이드 프로젝트 음성 채널에서 정한 것도 그대로 남아요.",
    logo: "discord",
    tone: "white",
  },
  {
    name: "회의실",
    line: "화면 없이 한 방에 모여도 돼요. 노트북을 테이블 가운데 두세요.",
    icon: DoorOpen,
    tone: "butter",
  },
  {
    name: "그 밖의 회의 앱",
    line: "여기 없는 앱이어도 돼요. 노트북에 들리기만 하면 받아 적어요.",
    icon: Plus,
    tone: "white",
    other: true,
  },
];

function AppCard({ app }: { app: App }) {
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
            // 로고는 판 없이 크게 둔다(Otter 처럼) — 흰 판 안의 작은 로고는 남의 앱 아이콘을 다시 그린 것처럼 읽혔다.
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
            {app.name}
          </p>
          <p className="m-0 mt-1.5 text-[13px] leading-[1.6] break-keep text-[var(--tv-body)] lg:text-[14px]">
            {app.line}
          </p>
        </div>
      </div>
    </li>
  );
}

/** 한 줄 — 같은 목록 세 벌. 첫 벌만 목록으로 읽히고 나머지 둘은 흐름을 잇는 복사본이다. */
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
              <AppCard key={app.name} app={app} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

/**
 * 가운데 알약. `left-1/2` 로 세우면 폭이 부모 반(320 에서 160)에 묶여 파형이 알약 밖으로 삐져나와서,
 * 양끝을 0 에 두고 `w-max` + `mx-auto` 로 가운데 맞춘다.
 * 알약(44px) — 카드 줄 사이 틈(20px)에 걸쳐 각 줄 카드의 위아래 안쪽 여백(16~20px) 안 12px 만 덮는다.
 */
function Listening() {
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
        기록 중
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
            어디서 회의하든, HeyMoa는{" "}
            <span className={cn(MARKER_REVEAL, "whitespace-nowrap")}>
              켜 두기만
            </span>{" "}
            하면 됩니다
          </h2>
          <p
            className={cn("tv-r", BODY, "mt-3 lg:mt-4 lg:text-[17px]")}
            style={vars({ "--i": 1 })}
          >
            쓰던 회의 앱은 그대로 두세요. HeyMoa는 회의에 들어가지 않고, 옆
            탭에서 노트북 마이크로 듣습니다. 봇을 초대할 일도, 연동을 걸 일도
            없어요.
          </p>
        </div>

        <div className="relative mt-8 flex flex-col gap-5 lg:mt-12">
          <Row apps={ROW_A} dir="left" dur="52s" i={2} />
          <Row apps={ROW_B} dir="right" dur="44s" i={3} />
          <Listening />
        </div>

        <div className="mx-auto mt-4 flex w-full max-w-[1120px] justify-end px-5 lg:px-10">
          {/* 보이는 크기 36px, 누름 칸 44px(`before:-inset-1`) — 히어로 일시정지와 같은 단추. */}
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className={cn(
              "relative inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-white pr-3.5 pl-3 text-[13px] font-bold text-[var(--tv-ink)] shadow-[0_2px_6px_-2px_rgba(28,24,69,0.3)] transition-colors before:absolute before:-inset-1 before:rounded-full hover:bg-[var(--tv-butter-soft)] motion-reduce:hidden",
              FOCUS
            )}
          >
            <PlayIcon aria-hidden className="size-4" />
            {paused ? "재생" : "일시정지"}
          </button>
        </div>
      </Reveal>
    </section>
  );
}
