import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { LandingCta } from "@/components/heymoa/landing-cta";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { localePath } from "@/lib/i18n/locales";
import { siteConfig } from "@/lib/site";

import { CONTAINER, FOCUS, TV_VARS } from "./tokens";
import { AppDownloadLink } from "./app-download-link";
import { RICH } from "./rich";

const SECTIONS = ["meetings", "evidence", "team", "ask", "safety"] as const;

export function useSectionNav(): Array<[string, string]> {
  const t = useTranslations("landing.nav");
  const home = localePath(useLocale(), "/");
  return SECTIONS.map((id) => [t(`sections.${id}`), `${home}#${id}`]);
}

const NAV_LINK = `inline-flex h-11 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[15px] font-semibold text-[var(--tv-body)] transition-colors hover:text-[var(--tv-brand-deep)] ${FOCUS}`;

export function TopBar() {
  const t = useTranslations("landing.nav");
  const locale = useLocale();
  const nav = useSectionNav();
  return (
    <header style={TV_VARS} className="sticky top-0 z-30 border-b border-[var(--tv-rule)] bg-white/90 backdrop-blur-md">
      <div className={`${CONTAINER} flex h-16 items-center gap-4`}>
        <Link
          href={localePath(locale, "/")}
          className={`inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full ${FOCUS}`}
        >
          <Image
            src="/apple-touch-icon.png"
            alt=""
            width={32}
            height={32}
            className="rounded-full object-contain"
            priority
          />
          <span className="text-[18px] font-extrabold tracking-[-0.03em] text-[var(--tv-ink)]">
            {siteConfig.name}
          </span>
        </Link>

        <nav aria-label={t("label")} className="ml-3 hidden items-center gap-1 md:flex">
          <DropdownMenu>
            {/* 펼친 목록은 포털로 `<body>` 에 붙어 이 바의 `TV_VARS` 를 못 받으니 다시 건다. */}
            <DropdownMenuTrigger className={`group inline-flex h-11 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[15px] font-semibold text-[var(--tv-body)] transition-colors hover:text-[var(--tv-brand-deep)] data-popup-open:text-[var(--tv-brand-deep)] ${FOCUS}`}>
              {t("features")}
              <ChevronDown aria-hidden className="size-4 transition-transform group-data-popup-open:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent style={TV_VARS} sideOffset={6} className="w-auto min-w-44 p-1.5">
              {nav.map(([label, href]) => (
                <DropdownMenuLinkItem
                  key={href}
                  href={href}
                  className="h-10 px-3 text-[15px] font-semibold text-[var(--tv-body)] focus:bg-[var(--tv-lav)] focus:text-[var(--tv-brand-deep)]"
                >
                  {label}
                </DropdownMenuLinkItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href={localePath(locale, "/pricing")} className={NAV_LINK}>
            {t("pricing")}
          </Link>
          <AppDownloadLink variant="nav" />
          <Link href={localePath(locale, "/help")} className={NAV_LINK}>
            {t("guide")}
          </Link>
        </nav>

        <div className="ml-auto flex items-center">
          <LandingCta
            label={t("start")}
            tooltip={t.rich("startTooltip", RICH)}
            className={`h-11 border-transparent bg-[var(--tv-brand)] px-5 text-[14px] font-bold text-white bg-clip-border hover:bg-[var(--tv-brand-deep)] focus-visible:border-[var(--tv-brand-deep)] focus-visible:ring-0 lg:h-10 ${FOCUS} focus-visible:outline-offset-0`}
          />
        </div>
      </div>
    </header>
  );
}
