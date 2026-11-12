import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { productLocale } from "@/lib/i18n/current";
import { noindexDirective, siteMetadataFor } from "@/lib/site";

/**
 * 카드 번호를 받는 면(첫 구독 결제 페이지 `/billing/checkout/{workspaceId}`, 카드 변경 문서 `/billing/card-change/{workspaceId}`, APP-1600). 제품 면과 같지만 **분석(GA·PostHog·Vercel)을 싣지
 * 않는다** — 제3자 스크립트가 같은 문서에 있으면 입력 값을 읽을 수 있다. 경로로 끄지 않고 루트 레이아웃을 가른 것은,
 * 루트가 다르면 다른 면과 오갈 때 문서가 새로 열려(하드 내비게이션) 앞 화면에서 켠 분석이 이 문서로 넘어오지 않기
 * 때문이다(메일 수신거부 면 `app/(mail)` 과 같은 방식). CSP 는 `proxy.ts`, 캐시·프레임 헤더는 `next.config.ts` 가 붙인다.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    ...siteMetadataFor(await productLocale()),
    robots: noindexDirective,
    alternates: null,
    referrer: "no-referrer",
  };
}

export default async function CardEntryRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell locale={await productLocale()} analytics={false}>
      {children}
    </AppShell>
  );
}
