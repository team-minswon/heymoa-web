"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import { CheckoutForm } from "@/components/billing/billing-checkout";
import { BusinessInfoList } from "@/components/heymoa/landing/business-info";
import { SitePageLink } from "@/components/heymoa/site-page-link";
import { buttonVariants } from "@/components/ui/button";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { goToSetupResult } from "@/lib/billing/navigate";
import { localePath } from "@/lib/i18n/locales";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export function BillingCheckoutPage({
  workspaceId,
  nextChargeAt,
}: {
  workspaceId: string;
  nextChargeAt: string;
}) {
  const t = useTranslations("billing.checkout");
  const plans = `/w/${workspaceId}?settings=billing`;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[560px] items-center justify-between gap-4 px-5">
        <span className="inline-flex items-center gap-2.5">
          <Image
            src="/apple-touch-icon.png"
            alt=""
            width={32}
            height={32}
            className="rounded-full object-contain"
            priority
          />
          <span className="text-[18px] font-medium tracking-tight text-[var(--el-ink)]">
            {siteConfig.name}
          </span>
        </span>
        <a
          href={plans}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "px-3 text-sm text-[var(--el-muted)]"
          )}
        >
          {t("pageBack")}
        </a>
      </header>
      <div className="mx-auto w-full max-w-[560px] px-5 pt-6 pb-16 sm:pt-10">
        <h1 className="text-3xl font-light tracking-[-0.03em] text-balance text-[var(--el-ink)]">
          {t("title")}
        </h1>
        <div className="mt-8">
          <DataBoundary
            resetKeys={[workspaceId]}
            fallback={
              <Skeleton
                aria-label={t("loading")}
                className="h-[1056px] w-full rounded-panel"
              />
            }
          >
            <CheckoutForm
              workspaceId={workspaceId}
              purpose="PURCHASE"
              backHref={plans}
              onResult={goToSetupResult}
              nextChargeAt={nextChargeAt}
            />
          </DataBoundary>
        </div>
        <CheckoutLegal />
      </div>
    </div>
  );
}

function CheckoutLegal() {
  const t = useTranslations("billing.checkout.business");
  const links = useTranslations("shell.focusChrome");
  const locale = useLocale();
  const link =
    "underline underline-offset-2 hover:text-[var(--el-ink)] whitespace-nowrap";
  return (
    <footer className="mt-10 grid gap-3 border-t border-[var(--el-hairline)] pt-6 text-[12px] leading-[1.6] text-[var(--el-muted)]">
      <p className="flex flex-wrap gap-x-4 gap-y-0.5">
        <SitePageLink href={localePath(locale, "/terms")} className={link}>
          {links("terms")}
        </SitePageLink>
        <SitePageLink href={localePath(locale, "/privacy")} className={link}>
          {links("privacy")}
        </SitePageLink>
      </p>
      <BusinessInfoList
        label={t("label")}
        labelOf={(key) => t(key)}
        className="text-[var(--el-muted)]"
      />
    </footer>
  );
}
