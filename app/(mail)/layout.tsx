import type { Metadata } from "next";

import { productLocale } from "@/lib/i18n/current";
import { AppShell } from "@/components/layout/app-shell";
import { noindexDirective, siteMetadataFor } from "@/lib/site";

/** 분석을 싣지 않습니다 — GA·PostHog 페이지뷰가 쿼리째 나가 토큰이 샙니다. 루트를 갈라야 하드 내비게이션으로 앞 화면의 분석이 넘어오지 않습니다. */
export async function generateMetadata(): Promise<Metadata> {
  return {
    ...siteMetadataFor(await productLocale()),
    robots: noindexDirective,
    alternates: null,
    referrer: "no-referrer",
  };
}

export default async function MailRootLayout({
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
