import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { noindexDirective, siteMetadata } from "@/lib/site";

/**
 * 메일 링크가 토큰을 주소에 싣고 여는 면(`/unsubscribe`, APP-1314). 제품 면과 같지만 **분석을 싣지 않는다** —
 * GA·PostHog 의 페이지뷰가 쿼리째 나가 토큰이 새기 때문이다. 경로로 끄지 않고 루트 레이아웃을 가른 것은, 루트가
 * 다르면 다른 면과 오갈 때 문서가 새로 열려 앞 화면에서 켠 분석이 이 면으로 넘어오지 않기 때문이다.
 *
 * `Cache-Control: no-store`·`Referrer-Policy: no-referrer` 응답 헤더는 `next.config.ts` 가 붙인다.
 */
export const metadata: Metadata = {
  ...siteMetadata,
  robots: noindexDirective,
  alternates: null,
  referrer: "no-referrer",
};

export default function MailRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell locale="ko" analytics={false}>
      {children}
    </AppShell>
  );
}
