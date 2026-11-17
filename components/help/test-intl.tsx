import { NextIntlClientProvider, createTranslator } from "next-intl";

import { messagesFor } from "@/i18n/messages";
import type { Locale } from "@/lib/i18n/locales";

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

export const testDatesT = (locale: Locale = "ko") =>
  createTranslator({
    locale,
    messages: messagesFor(locale),
    namespace: "dates",
  });

export const testAppT = (locale: Locale = "ko") =>
  createTranslator({ locale, messages: messagesFor(locale) });
