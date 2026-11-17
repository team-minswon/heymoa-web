"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  SETTINGS_LIST,
  SETTINGS_LIST_ROW,
  SettingsHeader,
} from "@/components/settings/settings-layout";
import {
  isRecordingLive,
  useRecording,
} from "@/components/transcription/recording-provider";
import { useUpdateCurrentUser } from "@/lib/api/generated/users/users";
import { writeLocaleCookie } from "@/lib/i18n/cookie";
import { initialLanguageSaveSettled } from "@/lib/i18n/initial-language-save";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

/** 테스트가 바꿔 끼운다. jsdom 의 `location.reload` 는 바꿀 수 없다. */
export const reloadDocument = { run: () => window.location.reload() };

export function LanguageSettings() {
  const t = useTranslations("common.language.settings");
  const current = useLocale() as Locale;
  const { user, setUser } = useAuth();
  const recording = useRecording();
  const locked = isRecordingLive(recording);
  const [pending, setPending] = useState<Locale | null>(null);
  const { mutate } = useUpdateCurrentUser();

  const choose = (language: Locale) => {
    if (locked || pending || language === current) return;
    setPending(language);
    void initialLanguageSaveSettled().then(() =>
      mutate(
        { data: { language } },
        {
          onSuccess: () => {
            if (user) setUser({ ...user, language });
            writeLocaleCookie(language);
            reloadDocument.run();
          },
          onError: () => setPending(null),
        }
      )
    );
  };

  return (
    <section className="max-w-[720px]">
      <SettingsHeader title={t("title")} description={t("description")} />
      {locked ? (
        <p
          role="status"
          className="mb-4 rounded-control border border-[var(--el-hairline)] bg-white px-4 py-3 text-sm text-[var(--el-body)]"
        >
          {t("recordingLocked")}
        </p>
      ) : null}
      <fieldset disabled={locked || pending !== null}>
        <legend className="sr-only">{t("options")}</legend>
        <ul className={SETTINGS_LIST}>
          {LOCALES.map((locale) => {
            const selected = (pending ?? current) === locale;
            return (
              <li key={locale}>
                <label
                  className={cn(
                    SETTINGS_LIST_ROW,
                    "cursor-pointer text-sm text-[var(--el-ink)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-[var(--el-ink)]"
                  )}
                >
                  <input
                    type="radio"
                    name="display-language"
                    value={locale}
                    checked={selected}
                    onChange={() => choose(locale)}
                    className="sr-only"
                  />
                  <span lang={locale} className="flex-1 whitespace-nowrap">
                    {LOCALE_NAMES[locale]}
                  </span>
                  {pending === locale ? (
                    <LoaderCircle
                      aria-label={t("saving")}
                      className="size-4 animate-spin text-[var(--el-muted)]"
                    />
                  ) : selected ? (
                    <Check
                      aria-hidden
                      className="size-4 text-[var(--el-ink)]"
                    />
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <p className="mt-3 text-xs text-[var(--el-muted)]">{t("aiNote")}</p>
    </section>
  );
}
