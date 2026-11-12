import { Check } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { LandingCta } from "@/components/heymoa/landing-cta";
import { PUBLIC_PRICING } from "@/lib/billing/pricing";
import { localePath } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

import {
  CAPTION,
  CONTAINER,
  FOCUS,
  H2,
  LABEL,
  LEAD,
  RADIUS,
  SECTION_Y,
} from "./tokens";

/**
 * 요금 안내(`#pricing`). 두 카드는 같은 줄 구성(이름 → 가격 → 한 줄 설명 → 녹음 · 멤버 → 모든 기능 → 버튼)이라
 * 격자가 늘린 높이에서 버튼만 `mt-auto` 로 바닥에 붙는다. 결제 조건(자동 결제 · 해지 · 환불)은 혜택 목록이 아니라
 * 카드 아래 작은 글이다. 기능 목록은 가격 안내 전용 키(`landing.pricing.features`)다.
 * 금액은 `PUBLIC_PRICING` 에서 오고 문구 파일에는 숫자가 없다. 앱 안 금액은 server 값이다.
 * 바탕 색은 FAQ(라벤더 옅은 면)와 근거 구간(버터)의 것을 그대로 쓴다.
 */
const FEATURES = [
  "liveNotes",
  "speakers",
  "links",
  "agentChat",
  "tools",
] as const;

export function Pricing() {
  const t = useTranslations("landing.pricing");
  const nav = useTranslations("landing.nav");
  const locale = useLocale();
  const plans = [
    {
      key: "free",
      bg: "bg-[var(--tv-lav-soft)]",
      price: 0,
      recording: t("free.recording", { hours: PUBLIC_PRICING.freeMonthlyHours }),
      cta: nav("start"),
      ctaClass:
        "border-transparent bg-white text-[var(--tv-ink)] hover:bg-[var(--tv-lav)]",
    },
    {
      key: "pro",
      bg: "bg-[var(--tv-butter)]",
      price: PUBLIC_PRICING.proMonthlyKrw,
      recording: t("pro.recording"),
      cta: t("pro.cta"),
      ctaClass:
        "border-transparent bg-[var(--tv-brand)] text-white hover:bg-[var(--tv-brand-deep)]",
    },
  ] as const;

  return (
    <section id="pricing" className={`bg-white ${SECTION_Y.color}`}>
      <div className={CONTAINER}>
        <h2 className={H2}>{t("title")}</h2>
        <p className={cn(LEAD, "mt-4")}>{t("lead")}</p>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:mt-12">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={cn(
                "flex flex-col p-7 lg:p-10",
                RADIUS.face,
                plan.bg
              )}
            >
              <p className="m-0 text-[15px] font-bold text-[var(--tv-body)]">
                {t(`${plan.key}.name`)}
              </p>
              <p className="m-0 mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-[40px] leading-none font-extrabold tracking-[-0.04em] text-[var(--tv-ink)] tabular-nums lg:text-[48px]">
                  {t(`${plan.key}.price`, { price: plan.price })}
                </span>
                {plan.key === "pro" ? (
                  <span className="text-[15px] text-[var(--tv-muted)]">
                    {t("perMonth")}
                  </span>
                ) : null}
              </p>
              <p className="m-0 mt-3 text-[16px] leading-[1.6] text-[var(--tv-body)]">
                {t(`${plan.key}.summary`)}
              </p>

              <ul className="m-0 mt-7 flex list-none flex-col gap-2.5 p-0 text-[16px] text-[var(--tv-ink)]">
                <CheckItem strong>{plan.recording}</CheckItem>
                <CheckItem>{t("members")}</CheckItem>
              </ul>

              <p className={cn(LABEL, "m-0 mt-7")}>{t("included")}</p>
              <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0 text-[15px] text-[var(--tv-body)]">
                {FEATURES.map((key) => (
                  <CheckItem key={key}>{t(`features.${key}`)}</CheckItem>
                ))}
              </ul>

              <div className="mt-auto pt-9">
                <LandingCta
                  label={plan.cta}
                  className={cn(
                    "w-full justify-center gap-2 font-bold focus-visible:border-transparent focus-visible:ring-0",
                    plan.ctaClass,
                    FOCUS
                  )}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-1">
          <p className={CAPTION}>{t("unit")}</p>
          <p className={CAPTION}>
            {t("terms", { hours: PUBLIC_PRICING.refundMaxRecordingHours })}{" "}
            <Link
              href={`${localePath(locale, "/terms")}#section-13`}
              className={cn(
                "rounded-sm font-semibold whitespace-nowrap text-[var(--tv-ink)] underline underline-offset-4",
                FOCUS
              )}
            >
              {t("refundLink")}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function CheckItem({
  strong = false,
  children,
}: {
  strong?: boolean;
  children: string;
}) {
  return (
    <li className={cn("flex items-start gap-2.5", strong && "font-bold")}>
      <Check
        aria-hidden
        className="mt-[3px] size-[18px] shrink-0 text-[var(--tv-brand)]"
        strokeWidth={2.5}
      />
      <span>{children}</span>
    </li>
  );
}
