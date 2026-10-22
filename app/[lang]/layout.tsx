import type { Metadata } from "next";
import { lang } from "next/root-params";

import { AppShell } from "@/components/layout/app-shell";
import { cookieLocale } from "@/lib/i18n/current";
import { isLocale, LOCALES } from "@/lib/i18n/locales";
import { siteMetadataFor } from "@/lib/site";

/**
 * 언어는 ko·en 뿐이다. 그 밖의 첫 세그먼트(`/foo/help`)는 미리 그린(●) 페이지라면 라우팅 단계에서 떨어져
 * `[...rest]` 의 404 가 된다. **요청 때 그리는(ƒ) 페이지에는 이 설정이 걸리지 않는다** — 그런 페이지(랜딩)는
 * 스스로 언어를 확인한다(`app/[lang]/page.tsx`). 루트 레이아웃에서 `notFound()` 를 부르면 그 위에 경계가 없어
 * Next 기본 404 가 뜬다(16.3.8 실측).
 */
export const generateStaticParams = () => LOCALES.map((lang) => ({ lang }));
export const dynamicParams = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await lang();
  // canonical·hreflang 은 페이지마다 `localizedMetadata` 가 단다. 사이트 공통값의 `/` 를 물려받지 않게 뺀다.
  return {
    ...siteMetadataFor(isLocale(locale) ? locale : "ko"),
    alternates: null,
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
  // 랜딩 상단 바 · 푸터는 마케팅 면 전부에 서고(`NavbarGate` · `FooterGate`, 클라이언트) 랜딩 문구를 쓴다.
  return (
    <AppShell
      locale={locale}
      clientNamespaces={["common", "auth", "landing", "help"]}
    >
      {children}
    </AppShell>
  );
}
