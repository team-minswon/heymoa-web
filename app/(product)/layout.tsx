import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { noindexDirective, siteMetadata } from "@/lib/site";

/**
 * 제품 면에는 검색에 내놓을 페이지가 없다(로그인 뒤 화면 · 토큰이 실리는 입구 · 목 화면). 그래서 **기본이 noindex 다** —
 * 새 라우트가 `privateRouteMetadata` 를 빠뜨려도 색인되지 않는다. canonical·hreflang 도 뺀다: 사이트 공통값의 `/` 를
 * 물려받으면 색인하지 않는 페이지가 홈의 중복이라고 말하게 된다. 크롤러가 noindex 를 읽도록 robots.txt 로는 막지 않는다
 * (`app/robots.ts`).
 */
export const metadata: Metadata = {
  ...siteMetadata,
  robots: noindexDirective,
  alternates: null,
};

/**
 * 제품 면의 루트 레이아웃(`/w/**`, `/settings/**`, `/invite`, `/oauth/**`, `/auth/callback`, 목 화면).
 * 주소에 언어 접두사가 없다. 제품 면 언어 결정(계정 → 쿠키 → ko)은 PRO-66-I07 이고, 지금은 한국어다.
 */
export default function ProductRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell locale="ko">{children}</AppShell>;
}
