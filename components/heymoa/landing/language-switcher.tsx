"use client";

import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { useAuthUserId } from "@/components/auth/auth-provider";
import { updateCurrentUser } from "@/lib/api/generated/users/users";
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

const ARCHIVED_LEGAL = /^\/(privacy|terms)\/\d{4}-\d{2}-\d{2}$/;
const targetPath = (locale: Locale, path: string) =>
  locale === DEFAULT_LOCALE ? path : path.replace(ARCHIVED_LEGAL, "/$1");

export function LanguageSwitcher() {
  const t = useTranslations("common.language");
  const { locale: current, path } = splitLocale(usePathname());
  const userId = useAuthUserId();

  const remember = (locale: Locale) => {
    writeLocaleCookie(locale);
    if (!userId) return;
    updateCurrentUser({ language: locale }, { keepalive: true }).catch(
      () => undefined
    );
  };

  return (
    <nav
      aria-label={t("heading")}
      className="inline-flex h-10 items-center gap-2.5 rounded-full border border-[var(--tv-rule-strong)] pr-4 pl-3 text-[13px] text-[var(--tv-muted)]"
    >
      <Globe aria-hidden className="size-4 shrink-0" />
      {LOCALES.map((locale, i) => (
        <Fragment key={locale}>
          {i > 0 ? (
            <span aria-hidden className="h-3 w-px bg-[var(--tv-rule-strong)]" />
          ) : null}
          <a
            href={localePath(locale, targetPath(locale, path))}
            lang={locale}
            hrefLang={locale}
            aria-current={locale === current ? "true" : undefined}
            onClick={() => remember(locale)}
            className={cn(
              "inline-flex min-h-8 items-center rounded-[4px] hover:text-[var(--tv-ink)]",
              locale === current && "font-bold text-[var(--tv-ink)]",
              FOCUS
            )}
          >
            {LOCALE_NAMES[locale]}
          </a>
        </Fragment>
      ))}
    </nav>
  );
}
