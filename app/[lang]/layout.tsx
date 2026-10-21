import type { Metadata } from "next";
import { lang } from "next/root-params";

import { AppShell } from "@/components/layout/app-shell";
import { cookieLocale } from "@/lib/i18n/current";
import { isLocale, LOCALES } from "@/lib/i18n/locales";
import { siteMetadata } from "@/lib/site";

/**
 * 언어는 ko·en 뿐이다. 그 밖의 첫 세그먼트(`/foo`)는 라우팅 단계의 404 가 되어 `app/global-not-found.tsx` 가 그린다.
 * 루트 레이아웃에서 `notFound()` 를 부르면 그 위에 경계가 없어 Next 기본 404 가 뜬다(16.3.8 실측).
 */
export const generateStaticParams = () => LOCALES.map((lang) => ({ lang }));
export const dynamicParams = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await lang();
  // canonical·hreflang 은 페이지마다 `localizedMetadata` 가 단다. 사이트 공통값의 `/` 를 물려받지 않게 뺀다.
  return {
    ...siteMetadata,
    alternates: null,
    openGraph: {
      ...siteMetadata.openGraph,
      locale: locale === "en" ? "en_US" : "ko_KR",
    },
  };
}

/**
 * 마케팅 면(랜딩, 다운로드, 사용 가이드, 약관, 개인정보처리방침)의 루트 레이아웃. 한국어는 무접두 주소가
 * `next.config.ts` rewrite 로 `/ko/...` 에, 영어는 `/en/...` 에 온다. `<html lang>` 은 root param 이 정한다.
 */
export default async function MarketingRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await lang();
  if (!isLocale(locale)) {
    // 첫 세그먼트가 언어가 아닌데 하위 주소가 있으면(`/wp-admin/x`) `[...rest]` 가 잡혀 여기 온다. 그 페이지가
    // 404 를 내므로 셸 없이 문서만 세운다 — 스캐너가 두드리는 아무 경로마다 SSR 유저 조회가 실서버로 나가지 않게(APP-224).
    return (
      <html lang={await cookieLocale()} className="h-full antialiased">
        <body className="min-h-full">{children}</body>
      </html>
    );
  }
  return <AppShell locale={locale}>{children}</AppShell>;
}
