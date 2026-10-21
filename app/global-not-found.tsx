import type { Metadata } from "next";
import "@fontsource-variable/inter";

import { NotFoundView } from "@/components/layout/not-found-view";
import { messagesFor } from "@/i18n/messages";
import { cookieLocale } from "@/lib/i18n/current";
import "./globals.css";

/**
 * 어느 라우트에도 매치되지 않은 URL의 404(첫 세그먼트가 언어도 제품 경로도 아닐 때).
 *
 * **루트 레이아웃을 안 거친다.** Next가 렌더를 건너뛰고 이 문서를 그대로 돌려주므로
 * `<html>`·`<body>`와 전역 스타일·폰트를 여기서 직접 들여온다. 그 덕에 봇·스캐너가
 * 두드리는 아무 경로마다 `getCurrentUserForSsr()`가 실서버를 부르는 일이 사라지고,
 * 루트 레이아웃이 실패해도 404 자리에 플랫폼 예외 화면이 뜨지 않는다.
 *
 * 레이아웃과 `params` 를 받지 못하므로 언어는 사용자가 고른 `heymoa-lang` 쿠키만 본다(없으면 한국어).
 * `/en` 아래의 없는 주소는 `app/[lang]/[...rest]` 가 잡으므로 여기 오지 않는다.
 *
 * 폰트는 Inter 하나만 싣는다(제목도 같은 글꼴). 404는 가장 많이 열리는 페이지라
 * 나머지를 여기까지 끌고 오지 않는다.
 */

export async function generateMetadata(): Promise<Metadata> {
  const text = messagesFor(await cookieLocale()).common.notFound;
  return {
    title: text.title,
    description: text.description,
    robots: { index: false, follow: false },
  };
}

export default async function GlobalNotFound() {
  const locale = await cookieLocale();
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full">
        <NotFoundView locale={locale} plainLink />
      </body>
    </html>
  );
}
