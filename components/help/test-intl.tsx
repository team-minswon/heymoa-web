import { NextIntlClientProvider, createTranslator } from "next-intl";

import { messagesFor } from "@/i18n/messages";
import type { Locale } from "@/lib/i18n/locales";

/**
 * 시험용 `render(…, { wrapper: intlWrapper() })`. 가이드 컴포넌트가 `useTranslations("help")` 를 쓰므로
 * 실제 앱의 마케팅 루트(`AppShell`)처럼 언어 파일을 내려 준다.
 */
export const intlWrapper = (locale: Locale = "ko") =>
  function IntlWrapper({ children }: { children: React.ReactNode }) {
    return (
      <NextIntlClientProvider
        locale={locale}
        messages={messagesFor(locale)}
        timeZone="Asia/Seoul"
      >
        {children}
      </NextIntlClientProvider>
    );
  };

/** React 밖 순수 함수 시험이 넘기는 번역 함수. 화면이 넘기는 `useTranslations("dates")` · `useTranslations()` 와 같은 꼴이다. */
export const testDatesT = (locale: Locale = "ko") =>
  createTranslator({
    locale,
    messages: messagesFor(locale),
    namespace: "dates",
  });

export const testAppT = (locale: Locale = "ko") =>
  createTranslator({ locale, messages: messagesFor(locale) });
