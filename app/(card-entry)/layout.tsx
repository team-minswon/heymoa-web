import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { productLocale } from "@/lib/i18n/current";
import { noindexDirective, siteMetadataFor } from "@/lib/site";

/** 분석 스크립트를 싣지 않는 루트 레이아웃입니다. 제3자 스크립트가 같은 문서에 있으면 카드 입력 값을 읽을 수 있고, 루트가 달라야 하드 내비게이션으로 앞 화면의 분석이 넘어오지 않습니다. */
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
