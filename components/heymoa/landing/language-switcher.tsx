"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { writeLocaleCookie } from "@/lib/i18n/cookie";
import {
  DEFAULT_LOCALE,
  LOCALE_NAMES,
  LOCALES,
  localePath,
  type Locale,
  splitLocale,
} from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

import { FOCUS } from "./tokens";

/**
 * 랜딩 푸터의 언어 선택. 같은 페이지의 다른 언어판으로 간다(`/help` ↔ `/en/help`).
 * 평범한 `<a>` 다 — 다른 언어판은 `<html lang>` 부터 다른 새 문서라 전체 로드가 맞다.
 */
/** 이전 판 법률 문서(`/privacy/2026-10-22`)는 한국어만 있다 — 다른 언어로는 그 문서의 지금 판으로 보낸다. */
const ARCHIVED_LEGAL = /^\/(privacy|terms)\/\d{4}-\d{2}-\d{2}$/;
const targetPath = (locale: Locale, path: string) =>
  locale === DEFAULT_LOCALE ? path : path.replace(ARCHIVED_LEGAL, "/$1");

export function LanguageSwitcher() {
  const t = useTranslations("common.language");
  const { locale: current, path } = splitLocale(usePathname());

  return (
    <nav aria-label={t("heading")} className="flex items-center gap-3">
      <span>{t("heading")}</span>
      {LOCALES.map((locale) => (
        <a
          key={locale}
          href={localePath(locale, targetPath(locale, path))}
          lang={locale}
          hrefLang={locale}
          aria-current={locale === current ? "true" : undefined}
          onClick={() => writeLocaleCookie(locale)}
          className={cn(
            "inline-flex min-h-8 items-center rounded-[4px] underline-offset-4 hover:text-[var(--tv-ink)] hover:underline",
            locale === current && "font-bold text-[var(--tv-ink)]",
            FOCUS
          )}
        >
          {LOCALE_NAMES[locale]}
        </a>
      ))}
    </nav>
  );
}
