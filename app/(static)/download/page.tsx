import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { TrackedLink } from "@/components/analytics/tracked-link";
import { DesktopAutoDownload } from "@/components/heymoa/desktop-auto-download";
import { HomebrewInstallCommand } from "@/components/heymoa/homebrew-install-command";
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
import { DESKTOP_INSTALLERS } from "@/lib/desktop/downloads";
import { cn } from "@/lib/utils";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "데스크톱 다운로드",
  description: "HeyMoa 데스크톱 설치와 업데이트 안내",
  alternates: { canonical: "/download" },
};

const PLATFORMS = [
  {
    name: "Mac",
    installers: DESKTOP_INSTALLERS.mac,
    need: "macOS 14.2 이상",
    steps: [
      "다운로드한 DMG 파일을 여세요.",
      "HeyMoa를 응용 프로그램 폴더로 옮긴 뒤 실행하세요.",
    ],
  },
  {
    name: "Windows",
    installers: DESKTOP_INSTALLERS.windows,
    need: "Windows 11 x64",
    steps: [
      "다운로드한 설치 파일을 실행하세요.",
      "「Windows의 PC 보호」 창이 뜨면 「추가 정보」를 누르세요.",
      "「실행」을 누르고 설치를 진행하세요.",
    ],
  },
] as const;

/** 랜딩과 같은 색·기둥을 쓰고, 루트 레이아웃의 main 안에 설치 방법을 둡니다. */
export default function DownloadPage() {
  return (
    <div
      style={TV_VARS}
      className="w-full flex-1 bg-white pb-6 text-[var(--tv-ink)] lg:pb-8"
    >
      <Suspense fallback={null}>
        <DesktopAutoDownload />
      </Suspense>
      <div className={cn(CONTAINER, "pt-3 lg:pt-6")}>
        <header
          className={cn(
            RADIUS.face,
            "bg-[var(--tv-lav)] px-6 py-8 lg:px-12 lg:py-10"
          )}
        >
          <h1 className={H2}>HeyMoa 앱 설치</h1>
          <p className={cn(LEAD, "mt-3")}>
            회의실 대화도, 화상회의·강의·유튜브에서 듣는 말도 기록하세요.
          </p>
        </header>
      </div>

      <div
        id="installers"
        className={cn(
          CONTAINER,
          "mt-8 grid scroll-mt-24 gap-4 md:grid-cols-2 lg:mt-12 lg:gap-6"
        )}
      >
        {PLATFORMS.map((platform) => (
          <section
            key={platform.name}
            className={cn(
              RADIUS.card,
              "border border-[var(--tv-rule)] bg-white p-6 lg:p-8"
            )}
          >
            <h2 className={CARD_TITLE}>{platform.name}</h2>
            <p className={cn(BODY, "mt-3")}>{platform.need}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {platform.installers.map((installer) => (
                <TrackedLink
                  key={installer.href}
                  event="desktop_download_clicked"
                  href={installer.href}
                  className={cn(
                    "inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--tv-brand)] px-5 py-3 text-[15px] font-bold text-white hover:bg-[var(--tv-brand-deep)]",
                    FOCUS
                  )}
                >
                  {installer.label}
                </TrackedLink>
              ))}
            </div>
            <ol
              aria-label={`${platform.name} 설치 방법`}
              className={cn(
                BODY,
                "mt-5 list-decimal space-y-2 pl-5 marker:font-semibold"
              )}
            >
              {platform.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {platform.name === "Mac" && (
              <div className="mt-5">
                <p className={BODY}>Homebrew로 설치</p>
                <HomebrewInstallCommand />
              </div>
            )}
          </section>
        ))}
      </div>

      <div className={cn(CONTAINER, "mt-6 lg:mt-8")}>
        <p className={cn(BODY, "mb-2")}>
          마이크 권한을 허용해 주세요. Mac의 컴퓨터 소리 권한은 첫 녹음 때
          요청합니다.
        </p>
        <p className={BODY}>
          권한 설정과 업데이트 방법은{" "}
          <Link
            href="/help/desktop"
            className={cn(
              "rounded-[4px] font-bold text-[var(--tv-brand-deep)] underline underline-offset-4 transition-colors hover:text-[var(--tv-brand)]",
              FOCUS
            )}
          >
            데스크톱 앱 사용법
          </Link>
          에서 확인하세요.
        </p>
      </div>
    </div>
  );
}
