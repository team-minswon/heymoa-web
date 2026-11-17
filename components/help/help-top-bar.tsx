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

export function HelpTopBar() {
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
        <div className="flex h-14 items-center gap-2 px-4 sm:gap-4 lg:px-6">
          <Link
            href={localePath(locale, "/")}
            aria-label={siteConfig.name}
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
            <span className="hidden text-[17px] font-extrabold tracking-[-0.03em] text-[var(--tv-ink)] sm:inline">
              {siteConfig.name}
            </span>
          </Link>
          <div className="mx-auto min-w-0 sm:w-full sm:max-w-[560px] sm:flex-1">
            <HelpPalette />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="hidden sm:block">
              <AppDownloadLink variant="nav" />
            </div>
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
