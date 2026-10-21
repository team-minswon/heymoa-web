"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import {
  LANG_COOKIE,
  LANG_COOKIE_MAX_AGE,
  LOCALE_NAMES,
  LOCALES,
  localePath,
  type Locale,
  splitLocale,
} from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

import { FOCUS } from "./tokens";

/** 고른 언어를 남긴다. 사용자가 직접 고를 때만 쓴다 — `/en` 에 들어온 것만으로는 쓰지 않는다. */
function rememberLocale(locale: Locale) {
  document.cookie = `${LANG_COOKIE}=${locale}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * 랜딩 푸터의 언어 선택. 같은 페이지의 다른 언어판으로 간다(`/help` ↔ `/en/help`).
 * 평범한 `<a>` 다 — 다른 언어판은 `<html lang>` 부터 다른 새 문서라 전체 로드가 맞다.
 */
export function LanguageSwitcher() {
  const t = useTranslations("common.language");
  const { locale: current, path } = splitLocale(usePathname());

  return (
    <nav aria-label={t("heading")} className="flex items-center gap-3">
      <span>{t("heading")}</span>
      {LOCALES.map((locale) => (
        <a
          key={locale}
          href={localePath(locale, path)}
          lang={locale}
          hrefLang={locale}
          aria-current={locale === current ? "true" : undefined}
          onClick={() => rememberLocale(locale)}
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
