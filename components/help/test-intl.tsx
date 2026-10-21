import { NextIntlClientProvider } from "next-intl";

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
