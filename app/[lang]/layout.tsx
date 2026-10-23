import type { Metadata } from "next";
import { lang } from "next/root-params";

import { AppShell } from "@/components/layout/app-shell";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "@/lib/i18n/locales";
import { siteMetadataFor } from "@/lib/site";

/**
 * 언어는 ko·en 뿐이다. 그 밖의 첫 세그먼트(`/foo/help`)는 미리 그린(●) 페이지라면 라우팅 단계에서 떨어져
 * 전역 404(`app/global-not-found.tsx`, 미리 그린 ○)가 된다. 언어 아래의 없는 주소(`/en/nope`)도 같다 — 예전에는
 * `[...rest]` 가 잡아 요청마다 그렸다(APP-1419). **요청 때 그리는(ƒ) 페이지에는 이 설정이 걸리지 않는다** — 마케팅 페이지는 모두
 * 미리 그리고(APP-1418), 랜딩은 그래도 스스로 언어를 확인한다(`app/[lang]/page.tsx`). 루트 레이아웃에서 `notFound()` 를 부르면 그 위에 경계가 없어
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
  // 언어가 아닌 첫 세그먼트는 라우팅 단계에서 전역 404 로 떨어져 여기 오지 않는다(`dynamicParams = false`).
  const value = await lang();
  const locale = isLocale(value) ? value : DEFAULT_LOCALE;
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
