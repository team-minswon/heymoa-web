import type { Metadata } from "next";
import "@fontsource-variable/inter/opsz.css";

import { NotFoundView } from "@/components/layout/not-found-view";
import { messagesFor } from "@/i18n/messages";
import {
  DEFAULT_LOCALE,
  LANG_COOKIE,
  LOCALES,
} from "@/lib/i18n/locales";
import "./globals.css";

/** 루트 레이아웃을 거치지 않아(Next 가 이 문서를 그대로 돌려줍니다) `<html>`·`<body>`·전역 스타일·폰트를 여기서 직접 들여옵니다. */

const notFoundText = (locale: (typeof LOCALES)[number]) =>
  messagesFor(locale).common.notFound;

// 제목은 위 스크립트가 고른 언어로 답니다. 여기 두면 하이드레이션이 한국어 제목으로 되돌립니다.
export const metadata: Metadata = {
  description: notFoundText(DEFAULT_LOCALE).description,
  robots: { index: false, follow: false },
};

const pickLocale = `(function(){var L=${JSON.stringify(LOCALES)},T=${JSON.stringify(
  Object.fromEntries(LOCALES.map((l) => [l, notFoundText(l).title]))
)},s=location.pathname.split("/")[1],c=(document.cookie.match(/(?:^|; )${LANG_COOKIE}=([^;]*)/)||[])[1],l=L.indexOf(s)>=0?s:L.indexOf(c)>=0?c:${JSON.stringify(
  DEFAULT_LOCALE
)};document.documentElement.lang=l;document.title=T[l]})()`;

const hideOthers = LOCALES.map(
  (l) => `html:not([lang="${l}"]) [data-not-found-locale="${l}"]{display:none}`
).join("");

export default function GlobalNotFound() {
  return (
    <html
      lang={DEFAULT_LOCALE}
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: pickLocale }} />
        <style dangerouslySetInnerHTML={{ __html: hideOthers }} />
      </head>
      <body className="min-h-full">
        {LOCALES.map((locale) => (
          <div key={locale} lang={locale} data-not-found-locale={locale}>
            <NotFoundView locale={locale} plainLink />
          </div>
        ))}
      </body>
    </html>
  );
}
