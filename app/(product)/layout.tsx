import type { Metadata } from "next";

import { LanguageSync } from "@/components/auth/language-sync";
import { AppShell } from "@/components/layout/app-shell";
import { productLocale } from "@/lib/i18n/current";
import { noindexDirective, siteMetadataFor } from "@/lib/site";

/** 기본이 noindex 이고 canonical·hreflang 을 뺍니다(물려받으면 홈의 중복이라고 말합니다). 크롤러가 noindex 를 읽어야 하므로 robots.txt 로는 막지 않습니다. */
export async function generateMetadata(): Promise<Metadata> {
  return {
    ...siteMetadataFor(await productLocale()),
    robots: noindexDirective,
    alternates: null,
  };
}

export default async function ProductRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell locale={await productLocale()}>
      <LanguageSync />
      {children}
    </AppShell>
  );
}
