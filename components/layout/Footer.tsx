"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { siteConfig } from "@/lib/site";
import { localePath } from "@/lib/i18n/locales";

/**
 * 범용 푸터. 랜딩 크롬 경로(`isLandingChromeRoute`)는 `FooterGate` 가 랜딩 푸터를 세우므로 여기 오지 않고,
 * 그 밖(`/invite` · `/mock-oauth` · `/settings/integrations` 등)만 이것을 쓴다. 그래서 `/` 에 있을 때의
 * 제자리 스크롤 갈래도 없다 — 구간 링크는 늘 랜딩으로 이동한다.
 */
export function Footer() {
  const router = useRouter();
  const t = useTranslations("shell.footer");
  const tNavbar = useTranslations("shell.navbar.sections");
  const tLegal = useTranslations("shell.focusChrome");
  const locale = useLocale();

  const handleScroll = (id: string) => {
    router.push(`/#${id}`);
  };

  return (
    <footer className="border-t border-[var(--el-hairline)] bg-[var(--el-canvas)] text-[var(--el-body)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_1fr] lg:px-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/apple-touch-icon.png"
              alt={siteConfig.name}
              width={36}
              height={36}
              className="rounded-full object-contain"
              priority
              loading="eager"
            />
            <span>
              <span className="block text-[16px] font-medium tracking-tight text-[var(--el-ink)]">
                {siteConfig.name}
              </span>
            </span>
          </Link>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--el-muted)]">
            {t("tagline")}
          </p>
          <p className="mt-4 text-[15px] text-[var(--el-muted)]">
            {t("contact")}{" "}
            <a
              href={`mailto:${siteConfig.contactEmail}`}
              className="font-medium text-[var(--el-ink)] underline underline-offset-4 hover:text-[var(--el-primary-active)]"
            >
              {siteConfig.contactEmail}
            </a>
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-[12px] font-semibold tracking-wider text-[var(--el-ink)] uppercase">
              {t("service")}
            </h2>
            <ul className="mt-4 space-y-3">
              <li>
                <button
                  onClick={() => handleScroll("meetings")}
                  className="text-[15px] font-medium text-[var(--el-muted)] transition hover:text-[var(--el-ink)] cursor-pointer"
                >
                  {tNavbar("meetings")}
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleScroll("evidence")}
                  className="text-[15px] font-medium text-[var(--el-muted)] transition hover:text-[var(--el-ink)] cursor-pointer"
                >
                  {tNavbar("evidence")}
                </button>
              </li>
              <li>
                <Link
                  href={localePath(locale, "/download")}
                  className="text-[15px] font-medium text-[var(--el-muted)] hover:text-[var(--el-ink)]"
                >
                  {t("download")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-[12px] font-semibold tracking-wider text-[var(--el-ink)] uppercase">
              {t("policy")}
            </h2>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href={localePath(locale, "/terms")}
                  className="text-[15px] font-medium text-[var(--el-muted)] transition hover:text-[var(--el-ink)]"
                >
                  {tLegal("terms")}
                </Link>
              </li>
              <li>
                <Link
                  href={localePath(locale, "/privacy")}
                  className="text-[15px] font-medium text-[var(--el-muted)] transition hover:text-[var(--el-ink)]"
                >
                  {tLegal("privacy")}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--el-hairline-soft)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-[15px] text-[var(--el-muted)] sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>© 2026 {siteConfig.name}. All rights reserved.</span>
          <span>
            {t("disclaimer")}
          </span>
        </div>
      </div>
    </footer>
  );
}
