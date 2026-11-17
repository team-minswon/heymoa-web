import type { Metadata } from "next";
import { lang } from "next/root-params";

import { AppShell } from "@/components/layout/app-shell";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "@/lib/i18n/locales";
import { siteMetadataFor } from "@/lib/site";

/** `dynamicParams = false` 는 요청 때 그리는(ƒ) 페이지에는 걸리지 않습니다. 루트 레이아웃에서 `notFound()` 를 부르면 위에 경계가 없어 Next 기본 404 가 뜹니다. */
export const generateStaticParams = () => LOCALES.map((lang) => ({ lang }));
export const dynamicParams = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await lang();
  return {
    ...siteMetadataFor(isLocale(locale) ? locale : "ko"),
    alternates: null,
  };
}

export default async function MarketingRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = await lang();
  const locale = isLocale(value) ? value : DEFAULT_LOCALE;
  return (
    <AppShell
      locale={locale}
      clientNamespaces={["common", "auth", "landing", "help"]}
    >
      {children}
    </AppShell>
  );
}
