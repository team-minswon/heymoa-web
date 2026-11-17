import type { ReactNode } from "react";
import { Check } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { LandingCta } from "@/components/heymoa/landing-cta";
import { PUBLIC_PRICING } from "@/lib/billing/pricing";
import { localePath } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

import { Sticky } from "./marks";
import { RICH } from "./rich";
import {
  CAPTION,
  CARD_TITLE,
  CONTAINER,
  FOCUS,
  H2,
  LABEL,
  LEAD,
  MARKER,
  RADIUS,
  SHADOW,
} from "./tokens";

const FEATURES = [
  "liveNotes",
  "speakers",
  "links",
  "agentChat",
  "tools",
] as const;

const SEATS = [3, 10, 30] as const;

const ROWS = "lg:row-span-5 lg:grid lg:grid-rows-subgrid";

const CTA_BASE =
  "w-full justify-center gap-2 px-5 font-bold whitespace-nowrap focus-visible:border-transparent focus-visible:ring-0";

export function Pricing() {
  const t = useTranslations("landing.pricing");
  const nav = useTranslations("landing.nav");
  const locale = useLocale();
  const proPrice = t("pro.price", { price: PUBLIC_PRICING.proMonthlyKrw });

  return (
    <section className="bg-white pt-8 pb-16 lg:pt-14 lg:pb-24">
      <div className={CONTAINER}>
        <p className="m-0 text-[15px] font-bold text-[var(--tv-brand-deep)]">
          {t("meta.title")}
        </p>
        <h1 className={cn(H2, "mt-3")}>
          {t.rich("title", {
            ...RICH,
            mark: (chunks) => (
              <span className={cn(MARKER, "whitespace-nowrap")}>{chunks}</span>
            ),
          })}
        </h1>
        <p className={cn(LEAD, "mt-4")}>{t("lead")}</p>

        <div className="mt-10 grid gap-6 lg:mt-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-y-0">
          <div
            className={cn(
              "flex flex-col border-[1.5px] border-[var(--tv-rule-strong)] bg-white p-7 lg:p-10",
              ROWS,
              RADIUS.face
            )}
          >
            <PlanHead
              name={t("free.name")}
              price={t("free.price", { price: 0 })}
              unit={t("free.note")}
              summary={t("free.summary")}
            />
            <Recording label={t("recording")}>
              {t("free.recording", { hours: PUBLIC_PRICING.freeMonthlyHours })}
            </Recording>
            <div className="mt-auto pt-8 lg:col-start-1">
              <LandingCta
                label={nav("start")}
                pricingPlan="free"
                className={cn(
                  CTA_BASE,
                  "border-[var(--tv-rule-strong)] bg-white text-[var(--tv-ink)] hover:bg-[var(--tv-lav-soft)]",
                  FOCUS
                )}
              />
            </div>
          </div>

          <div
            className={cn(
              "flex flex-col bg-[var(--tv-lav)] p-7 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-x-10 lg:p-10 xl:grid-cols-[minmax(0,1fr)_260px]",
              ROWS,
              RADIUS.face
            )}
          >
            <PlanHead
              name={t("pro.name")}
              price={proPrice}
              unit={t("perMonth")}
              summary={t("pro.summary")}
            />
            <Recording label={t("recording")}>
              <span className={MARKER}>{t("pro.recording")}</span>
            </Recording>

            <div className="relative mt-12 lg:col-start-2 lg:row-span-5 lg:row-start-1 lg:mt-0 lg:self-center">
              <Sticky
                tilt={4}
                size="sm"
                className="absolute -top-7 -right-2 z-10"
              >
                {t("sticky")}
              </Sticky>
              <ul
                className={cn(
                  "m-0 list-none bg-white px-4 py-1.5 xl:px-5",
                  RADIUS.window,
                  SHADOW.panel
                )}
                style={{ rotate: "-1.5deg" }}
              >
                {SEATS.map((count) => (
                  <li
                    key={count}
                    className="flex items-baseline justify-between gap-3 border-b border-[var(--tv-rule)] py-3 text-[14px] whitespace-nowrap last:border-b-0 xl:text-[15px]"
                  >
                    <span className="text-[var(--tv-body)]">
                      {t("seats", { count })}
                    </span>
                    <span className="font-extrabold text-[var(--tv-ink)] tabular-nums">
                      {proPrice}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-8 lg:col-start-1">
              <LandingCta
                label={t("pro.cta")}
                member={{ label: t("pro.ctaMember"), to: "checkout" }}
                pricingPlan="pro"
                className={cn(
                  CTA_BASE,
                  "border-transparent bg-[var(--tv-brand)] text-white hover:bg-[var(--tv-brand-deep)]",
                  FOCUS
                )}
              />
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-6 flex flex-col gap-4 border border-[var(--tv-rule)] px-7 py-6 lg:flex-row lg:gap-10 lg:px-10 lg:py-7",
            RADIUS.card
          )}
        >
          <p className="m-0 shrink-0 text-[15px] font-bold text-[var(--tv-ink)] lg:w-[150px]">
            {t("included")}
          </p>
          <ul className="m-0 grid flex-1 list-none grid-cols-1 gap-x-8 gap-y-2.5 p-0 text-[15px] text-[var(--tv-body)] sm:grid-cols-2 lg:grid-cols-3">
            <CheckItem>{t("members")}</CheckItem>
            {FEATURES.map((key) => (
              <CheckItem key={key}>{t(`features.${key}`)}</CheckItem>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-1">
          <p className={CAPTION}>
            {t("terms")}{" "}
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

function PlanHead({
  name,
  price,
  unit,
  summary,
}: {
  name: string;
  price: string;
  unit?: string;
  summary: string;
}) {
  return (
    <>
      <p className="m-0 text-[15px] font-bold text-[var(--tv-body)] lg:col-start-1">
        {name}
      </p>
      <p className="m-0 mt-3 lg:col-start-1">
        <span className="block text-[40px] leading-none font-extrabold tracking-[-0.04em] text-[var(--tv-ink)] tabular-nums xl:text-[48px]">
          {price}
        </span>
        {unit ? (
          <span className="mt-2 block text-[14px] leading-[1.4] text-[var(--tv-muted)]">
            {unit}
          </span>
        ) : null}
      </p>
      <p className="m-0 mt-3 text-[16px] leading-[1.6] text-[var(--tv-body)] lg:col-start-1">
        {summary}
      </p>
    </>
  );
}

function Recording({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-7 border-t border-[var(--tv-rule-strong)] pt-6 lg:col-start-1">
      <p className={cn(LABEL, "m-0")}>{label}</p>
      <p className={cn(CARD_TITLE, "mt-1.5")}>{children}</p>
    </div>
  );
}

function CheckItem({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check
        aria-hidden
        className="mt-[3px] size-[18px] shrink-0 text-[var(--tv-brand)]"
        strokeWidth={2.5}
      />
      <span>{children}</span>
    </li>
  );
}
