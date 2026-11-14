import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Pricing } from "@/components/heymoa/landing/pricing";
import { TV_VARS } from "@/components/heymoa/landing/tokens";
import { WebPageJsonLd } from "@/components/help/json-ld";
import { PUBLIC_PRICING } from "@/lib/billing/pricing";
import { marketingLocale } from "@/lib/i18n/current";
import { localePath, type Locale } from "@/lib/i18n/locales";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const dynamic = "force-static";

/** 제목과 설명. 금액 · 시간은 `PUBLIC_PRICING` 에서 오고 문구 파일에는 숫자가 없다. */
async function pageMeta(locale: Locale) {
  const t = await getTranslations({ locale, namespace: "landing.pricing" });
  const brand = (await getTranslations({ locale, namespace: "landing.meta" }))(
    "brandLabel"
  );
  return {
    title: t("meta.title"),
    description: t("meta.description", {
      brand,
      hours: PUBLIC_PRICING.freeMonthlyHours,
      price: PUBLIC_PRICING.proMonthlyKrw,
    }),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await marketingLocale();
  const meta = await pageMeta(locale);
  return { ...meta, ...localizedMetadata(locale, "/pricing", meta) };
}

/** 가격 안내(`/pricing`). 랜딩과 같은 색 · 기둥을 쓰고, 본문은 `Pricing` 하나다. 로그인 없이 볼 수 있다. */
export default async function PricingPage() {
  const locale = await marketingLocale();
  const meta = await pageMeta(locale);
  return (
    <div
      style={TV_VARS}
      className="w-full flex-1 bg-white text-[var(--tv-ink)]"
    >
      <WebPageJsonLd
        name={meta.title}
        description={meta.description}
        path={localePath(locale, "/pricing")}
        inLanguage={locale}
      />
      <Pricing />
    </div>
  );
}
