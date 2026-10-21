"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { LandingCta } from "@/components/heymoa/landing-cta";
import { AppDownloadLink } from "@/components/heymoa/landing/app-download-link";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import { pickHelpAxis, useHelpAxis } from "@/components/help/help-axis";
import { HelpPalette } from "@/components/help/help-palette";
import { HELP_VARS } from "@/components/help/help-vars";
import type { HelpAxis } from "@/app/[lang]/help/_content/types";
import { localePath, splitLocale } from "@/lib/i18n/locales";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

const TABS: readonly HelpAxis[] = ["feature", "situation"];

/**
 * 사용 가이드 고정 상단바. 위 줄(56): 로고 · 가운데 검색 · 앱 다운로드 / 대시보드. 아래 줄(40): 기능별 / 상황별 탭.
 * 탭은 페이지를 옮기지 않고 사이드바가 보여 줄 축만 바꾼다(`help-axis.ts`). 높이 합계는 `--help-top`(globals.css).
 * `<main>` 밖(`NavbarGate`)에 서서 건너뛰기 링크가 이 바도 건너뛴다. ⌘K 는 여기 한 곳(`HelpPalette`)에서만 듣는다.
 */
export function HelpTopBar() {
  // 언어 접두사를 벗긴 경로. 한국어 SSR 의 `/ko/help/...`(rewrite 뒤 주소)와 영어판 `/en/help/...` 이 같은 판정을 받는다.
  const pathname = splitLocale(usePathname()).path;
  const axis = useHelpAxis(pathname);
  const locale = useLocale();
  const t = useTranslations("help.topBar");
  return (
    <header
      style={HELP_VARS}
      className="sticky top-0 z-30 border-b border-[var(--tv-rule)] bg-white"
    >
      <div className="mx-auto w-full max-w-[1800px]">
        <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
          <Link
            href={localePath(locale, "/")}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2.5 rounded-full",
              FOCUS
            )}
          >
            <Image
              src="/apple-touch-icon.png"
              alt=""
              width={28}
              height={28}
              className="rounded-full object-contain"
              priority
            />
            <span className="text-[17px] font-extrabold tracking-[-0.03em] text-[var(--tv-ink)]">
              {siteConfig.name}
            </span>
          </Link>
          <div className="mx-auto w-full min-w-0 max-w-[560px] flex-1">
            <HelpPalette />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <AppDownloadLink variant="nav" />
            <LandingCta
              label={t("start")}
              className={`h-9 border-transparent bg-[var(--tv-brand)] px-4 text-[14px] font-bold text-white bg-clip-border hover:bg-[var(--tv-brand-deep)] focus-visible:border-[var(--tv-brand-deep)] focus-visible:ring-0 ${FOCUS} focus-visible:outline-offset-0`}
            />
          </div>
        </div>
        <div
          role="group"
          aria-label={t("tabs")}
          className="flex h-10 items-stretch gap-1 px-4 lg:px-6"
        >
          {TABS.map((tab) => {
            const on = tab === axis;
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={on}
                onClick={() => pickHelpAxis(pathname, tab)}
                className={cn(
                  "relative px-3 text-[14px] font-semibold help-fade after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--tv-ink)] after:transition-opacity after:duration-(--help-fast) motion-reduce:after:transition-none",
                  FOCUS,
                  on
                    ? "text-[var(--tv-ink)] after:opacity-100"
                    : "text-[var(--tv-muted)] after:opacity-0 hover:text-[var(--tv-ink)]"
                )}
              >
                {t(tab)}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
