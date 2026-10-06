import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { LandingCta } from "@/components/heymoa/landing-cta";
import {
  BODY,
  CARD_TITLE,
  CONTAINER,
  FOCUS,
  H2,
  LEAD,
  RADIUS,
  TV_VARS,
} from "@/components/heymoa/landing/tokens";
import { DESKTOP_RELEASES_URL } from "@/lib/desktop/downloads";
import { cn } from "@/lib/utils";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "데스크톱 다운로드",
  description: "HeyMoa 데스크톱 베타 설치와 업데이트 안내",
  alternates: { canonical: "/download" },
};

/** 플랫폼 카드 안 「주의」 상자. 버터 면 위 body 글자(9:1 이상). */
const CAUTION =
  "mt-5 rounded-[16px] bg-[var(--tv-butter-soft)] px-4 py-3 text-[15px] leading-[1.7] break-keep text-[var(--tv-body)] [overflow-wrap:anywhere]";

const PLATFORMS = [
  {
    name: "Mac",
    need: "macOS 14.2 이상에서 사용합니다. Apple Silicon은 arm64, Intel Mac은 x64\u00a0DMG를 선택하고 HeyMoa를 응용 프로그램 폴더로 옮겨 주세요.",
    caution:
      "현재 베타는 Apple 서명·공증이 없어 macOS가 실행을 차단할 수 있습니다. 공식 설치 파일인지 확인한 뒤 시스템 설정\u00a0→ 개인정보 보호 및 보안에서 열기를 허용해 주세요.",
  },
  {
    name: "Windows",
    need: "x64\u00a0EXE 설치 파일을 사용합니다.",
    caution:
      "베타 설치·녹음의 실제 Windows 검증은 진행 중입니다. 서명되지 않은 설치 파일에는 SmartScreen 경고가 표시될 수 있습니다.",
  },
] as const;

/**
 * 데스크톱 다운로드. **약관 · 개인정보(`legal-document.tsx`)와 같은 면이다** — 랜딩 상단 바 · 푸터
 * (`isLandingChromeRoute`)를 쓰고, 루트에 `TV_VARS` 를 걸어 흰 바탕 위 라벤더 머리 판, 흰 플랫폼 카드 둘,
 * 연보라 「설정과 업데이트」 판으로 짠다. 머리 판도 카드와 같은 `CONTAINER` 기둥에 선다(약관과 같은 이유 —
 * 무대 폭이면 바로 아래 카드와 가장자리가 어긋난다). 읽는 안내라 스크롤 리빌 · 쪽지 · 테이프는 없다.
 *
 * 루트는 `div` 다 — 루트 레이아웃이 이미 `<main id="main">` 으로 감싼다. `flex-1` 로 그 세로 칸을 채운다 —
 * 짧은 안내라 화면이 이 페이지보다 높으면 흰 본문과 흰 푸터 사이로 루트의 `--el-canvas` 회색이 비친다.
 *
 * 묶여야 할 낱말(「x64 DMG」, 「설정 →」)은 줄바꿈 없는 공백으로 잇는다 — 좁은 폭에서 화살표가 줄머리에 섰다.
 */
export default function DownloadPage() {
  return (
    <div style={TV_VARS} className="w-full flex-1 bg-white pb-6 text-[var(--tv-ink)] lg:pb-8">
      <div className={cn(CONTAINER, "pt-3 lg:pt-6")}>
        <header className={cn(RADIUS.face, "bg-[var(--tv-lav)] px-6 py-10 lg:px-12 lg:py-16")}>
          <p className="m-0 inline-flex h-7 items-center rounded-full bg-white px-3 text-[13px] font-extrabold leading-none tracking-[0.02em] text-[var(--tv-brand-deep)]">
            HeyMoa 데스크톱 · 베타
          </p>
          {/* 약관 제목과 같은 H2 급 — 히어로 급을 쓰면 안내 한 장이 첫 화면처럼 군다. */}
          <h1 className={cn(H2, "mt-4 max-w-[820px]")}>회의는 그대로, 기록은 더 가까이</h1>
          <p className={cn(LEAD, "mt-4 max-w-[640px] lg:max-w-[860px]")}>
            웹에서 쓰던 HeyMoa에 컴퓨터에서 나는 소리까지 녹음하는 기능과 메뉴바 타임라인을
            더했습니다. <br className="hidden lg:inline" />
            앱에서도 같은 웹 서비스를 사용합니다.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={DESKTOP_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-[var(--tv-brand)] px-6 text-[15px] font-bold text-white transition-colors hover:bg-[var(--tv-brand-deep)]",
                FOCUS
              )}
            >
              설치 파일과 새 버전 보기
              <ArrowUpRight aria-hidden className="size-4" />
              <span className="sr-only">(새 창)</span>
            </a>
            {/* 설치 없이 지금 쓰려는 사람의 길. 로그인 상태면 대시보드로 간다(`LandingCta`). */}
            <LandingCta
              label="웹에서 바로 시작"
              className={cn(
                "justify-center gap-2 border-[var(--tv-rule-strong)] bg-white font-bold text-[var(--tv-ink)] bg-clip-border hover:bg-[var(--tv-lav-soft)] focus-visible:border-[var(--tv-rule-strong)] focus-visible:ring-0",
                FOCUS
              )}
            />
          </div>
        </header>
      </div>

      <div className={cn(CONTAINER, "mt-8 grid gap-4 md:grid-cols-2 lg:mt-12 lg:gap-6")}>
        {PLATFORMS.map((platform) => (
          <section
            key={platform.name}
            className={cn(RADIUS.card, "border border-[var(--tv-rule)] bg-white p-6 lg:p-8")}
          >
            <h2 className={CARD_TITLE}>{platform.name}</h2>
            <p className={cn(BODY, "mt-3")}>{platform.need}</p>
            <p className={CAUTION}>
              <b className="font-extrabold text-[var(--tv-ink)]">주의 </b>
              {platform.caution}
            </p>
          </section>
        ))}
      </div>

      <div className={cn(CONTAINER, "mt-4 lg:mt-6")}>
        <section className={cn(RADIUS.card, "bg-[var(--tv-lav-soft)] p-6 lg:p-8")}>
          <h2 className={CARD_TITLE}>설정과 업데이트</h2>
          <div className="mt-3 grid gap-3 lg:mt-4 lg:grid-cols-2 lg:gap-8">
            <p className={BODY}>
              첫 실행에서 마이크 설정을 안내합니다. 컴퓨터 오디오 권한은 녹음을 시작할 때
              확인합니다. 권한 설정은 나중에도 할 수 있습니다.
            </p>
            <p className={BODY}>
              새 버전은 위 공식 배포 페이지에서 확인해 주세요. 자동 업데이트는 제공하지
              않으므로 녹음을 중지하고 앱을 종료한 뒤 새 설치 파일로 업데이트합니다.
            </p>
          </div>
          <p className="m-0 mt-4 break-keep text-[14px] leading-[1.65] text-[var(--tv-muted)] [overflow-wrap:anywhere] lg:mt-6">
            Homebrew 설치 명령과 각 파일의 SHA256은 공식 배포 페이지와 tap README에서 확인할 수
            있습니다.
          </p>
        </section>

        <Link
          href="/"
          className={cn(
            "mt-6 inline-flex min-h-6 items-center rounded-[4px] text-[15px] font-bold text-[var(--tv-brand-deep)] underline underline-offset-4 transition-colors hover:text-[var(--tv-brand)] lg:mt-8",
            FOCUS
          )}
        >
          웹으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
