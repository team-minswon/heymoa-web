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

/**
 * 설정 > 계정 > 언어(APP-1285). 처음에는 브라우저 언어로 정한 초기 기본값이 계정에 들어가고, 여기서 덮어쓴다.
 *
 * - 고르면 계정(`PATCH /v1/users/me`)에 저장하고, 성공한 뒤 쿠키를 쓰고 **문서를 새로 연다.** `router.refresh` 는
 *   Query 캐시에 받아 둔 옛 언어 오류 문구와 열린 SSE 의 `Accept-Language` 를 그대로 남긴다. 실패하면 새로고침하지
 *   않고 전역 mutation 토스트가 알린다.
 * - 녹음 중에는 고를 수 없다. 새로고침이 녹음을 끊는데, 녹음 중인 회의의 AI 언어는 시작할 때 이미 정해져(APP-1299)
 *   바꿔도 얻는 것이 없다. 지속 상태라 인라인으로 알린다(rule `error-loading`).
 * - 선택지 이름은 화면 언어와 상관없이 그 언어 자신의 이름이다. 탭 이름도 두 언어를 같이 적는다(`settings-dialog`) —
 *   언어를 바꾸려는 사람은 아직 못 읽는 언어의 화면을 보고 있다.
 */
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
    // 로그인 직후 초기값 저장이 아직 가는 중이면 끝난 뒤에 보낸다 — 늦게 닿은 초기값이 고른 언어를 되돌리지 않게.
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
