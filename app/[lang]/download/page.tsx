import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { TrackedLink } from "@/components/analytics/tracked-link";
import { DesktopAutoDownload } from "@/components/heymoa/desktop-auto-download";
import { HomebrewInstallCommand } from "@/components/heymoa/homebrew-install-command";
import { RICH } from "@/components/heymoa/landing/rich";
import {
  BODY,
  CARD_TITLE,
  CONTAINER,
  FOCUS,
  H2,
  LEAD,
  RADIUS,
  TV_VARS,
} from "@/components/heymoa/landing/tokens";
import { WebPageJsonLd } from "@/components/help/json-ld";
import { DESKTOP_INSTALLERS } from "@/lib/desktop/downloads";
import { marketingLocale } from "@/lib/i18n/current";
import { localePath } from "@/lib/i18n/locales";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export const dynamic = "force-static";

/** 플랫폼 이름(Mac · Windows)은 어느 언어에서나 그대로이고, 나머지 글은 언어 파일 `download` 에 있다. */
const PLATFORMS = [
  { key: "mac", name: "Mac", installers: DESKTOP_INSTALLERS.mac },
  { key: "windows", name: "Windows", installers: DESKTOP_INSTALLERS.windows },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await marketingLocale();
  const t = await getTranslations({ locale, namespace: "download" });
  const brand = (await getTranslations({ locale, namespace: "landing.meta" }))(
    "brandLabel"
  );
  const description = t("meta.description", { brand });
  return {
    title: t("meta.title"),
    description,
    ...localizedMetadata(locale, "/download", {
      title: t("meta.title"),
      description,
    }),
  };
}

/** 랜딩과 같은 색·기둥을 쓰고, 루트 레이아웃의 main 안에 설치 방법을 둡니다. */
export default async function DownloadPage() {
  const locale = await marketingLocale();
  const t = await getTranslations({ locale, namespace: "download" });
  const brand = (await getTranslations({ locale, namespace: "landing.meta" }))(
    "brandLabel"
  );
  return (
    <div
      style={TV_VARS}
      className="w-full flex-1 bg-white pb-6 text-[var(--tv-ink)] lg:pb-8"
    >
      <WebPageJsonLd
        name={t("meta.title")}
        description={t("meta.description", { brand })}
        path={localePath(locale, "/download")}
        inLanguage={locale}
        extra={{
          "@type": "SoftwareApplication",
          name: brand,
          applicationCategory: "BusinessApplication",
          operatingSystem: PLATFORMS.map(({ key }) =>
            t(`platforms.${key}.need`)
          ).join(", "),
          downloadUrl: PLATFORMS.flatMap(({ installers }) =>
            installers.map(({ href }) => `${siteConfig.url}${href}`)
          ),
        }}
      />
      <Suspense fallback={null}>
        <DesktopAutoDownload title={t("autoDownloadTitle")} />
      </Suspense>
      <div className={cn(CONTAINER, "pt-3 lg:pt-6")}>
        <header
          className={cn(
            RADIUS.face,
            "bg-[var(--tv-lav)] px-6 py-8 lg:px-12 lg:py-10"
          )}
        >
          <h1 className={H2}>{t("heading")}</h1>
          <p className={cn(LEAD, "mt-3")}>{t("lead")}</p>
        </header>
      </div>

      <div
        id="installers"
        className={cn(
          CONTAINER,
          "mt-8 grid scroll-mt-24 gap-4 md:grid-cols-2 lg:mt-12 lg:gap-6"
        )}
      >
        {PLATFORMS.map((platform) => (
          <section
            key={platform.key}
            className={cn(
              RADIUS.card,
              "border border-[var(--tv-rule)] bg-white p-6 lg:p-8"
            )}
          >
            <h2 className={CARD_TITLE}>{platform.name}</h2>
            <p className={cn(BODY, "mt-3")}>
              {t(`platforms.${platform.key}.need`)}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {platform.installers.map((installer) => (
                <TrackedLink
                  key={installer.href}
                  event="desktop_download_clicked"
                  href={installer.href}
                  className={cn(
                    "inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--tv-brand)] px-5 py-3 text-[15px] font-bold text-white hover:bg-[var(--tv-brand-deep)]",
                    FOCUS
                  )}
                >
                  {t(`platforms.${platform.key}.installer`)}
                </TrackedLink>
              ))}
            </div>
            <ol
              aria-label={t("stepsLabel", { platform: platform.name })}
              className={cn(
                BODY,
                "mt-5 list-decimal space-y-2 pl-5 marker:font-semibold"
              )}
            >
              {t.raw(`platforms.${platform.key}.steps`).map((step: string) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {platform.key === "mac" && (
              <div className="mt-5">
                <p className={BODY}>{t("homebrew.intro")}</p>
                <HomebrewInstallCommand
                  label={t("homebrew.label")}
                  copyLabel={t("homebrew.copy")}
                  copied={t("homebrew.copied")}
                  failed={t("homebrew.failed")}
                />
              </div>
            )}
          </section>
        ))}
      </div>

      <div className={cn(CONTAINER, "mt-6 lg:mt-8")}>
        <p className={cn(BODY, "mb-2")}>{t("permissions")}</p>
        <p className={BODY}>
          {t.rich("guide", {
            ...RICH,
            link: (chunks) => (
              <Link
                href={localePath(locale, "/help/start/desktop")}
                className={cn(
                  "rounded-[4px] font-bold text-[var(--tv-brand-deep)] underline underline-offset-4 transition-colors hover:text-[var(--tv-brand)]",
                  FOCUS
                )}
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </div>
  );
}
