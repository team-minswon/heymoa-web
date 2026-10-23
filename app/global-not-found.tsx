import type { Metadata } from "next";
import "@fontsource-variable/inter";

import { NotFoundView } from "@/components/layout/not-found-view";
import { messagesFor } from "@/i18n/messages";
import {
  DEFAULT_LOCALE,
  LANG_COOKIE,
  LOCALES,
} from "@/lib/i18n/locales";
import "./globals.css";

/**
 * 어느 라우트에도 매치되지 않은 URL의 404. 언어 접두사 아래의 없는 주소(`/en/nope`, `/help/nope`)와 스캐너
 * 경로(`/meta.json`, `/wp-admin/x`)가 모두 여기 온다.
 *
 * **루트 레이아웃을 안 거친다.** Next가 렌더를 건너뛰고 이 문서를 그대로 돌려주므로
 * `<html>`·`<body>`와 전역 스타일·폰트를 여기서 직접 들여온다. 그 덕에 봇·스캐너가
 * 두드리는 아무 경로마다 `getCurrentUserForSsr()`가 실서버를 부르는 일이 사라지고,
 * 루트 레이아웃이 실패해도 404 자리에 플랫폼 예외 화면이 뜨지 않는다.
 *
 * **미리 그린다(○, APP-1419).** 쿠키·주소를 서버에서 읽으면 요청마다 함수가 돈다. 그래서 언어마다 본문을 하나씩
 * 그려 두고, 첫 페인트 전에 인라인 스크립트가 고른다 — 주소의 언어 접두사(`/en/...`), 없으면 사용자가 고른
 * `heymoa-lang` 쿠키, 없으면 한국어. `<html lang>` 이 바뀌면 CSS 가 다른 언어 본문을 숨긴다.
 *
 * 폰트는 Inter 하나만 싣는다(제목도 같은 글꼴). 404는 가장 많이 열리는 페이지라
 * 나머지를 여기까지 끌고 오지 않는다.
 */

const notFoundText = (locale: (typeof LOCALES)[number]) =>
  messagesFor(locale).common.notFound;

// 제목은 위 스크립트가 고른 언어로 단다. 여기 두면 하이드레이션이 한국어 제목으로 되돌린다.
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
