"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { track } from "@/lib/analytics/track";
import { desktopDownload } from "@/lib/desktop/downloads";
import { localePath } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";
import { FOCUS } from "./tokens";
import { PlatformIcon } from "@/components/heymoa/desktop-platform-icon";

export function AppDownloadLink({
  variant = "hero",
}: {
  variant?: "hero" | "nav";
}) {
  const t = useTranslations("landing.download");
  const locale = useLocale();
  const router = useRouter();
  const [target, setTarget] = useState<Awaited<
    ReturnType<typeof desktopDownload>
  > | null>(null);
  useEffect(() => {
    let active = true;
    void desktopDownload(navigator).then((result) => {
      if (active) setTarget(result);
    });
    return () => {
      active = false;
    };
  }, []);

  function startDownload(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    window.open(event.currentTarget.href, "_blank", "noopener,noreferrer");
    track("desktop_download_clicked");
    router.push(localePath(locale, "/download"));
  }

  const en = locale === "en";
  const className = cn(
    variant === "hero"
      ? "hidden h-[52px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[var(--tv-rule-strong)] bg-white px-2 text-[14px] font-bold text-[var(--tv-ink)] transition-colors hover:bg-[var(--tv-lav-soft)] lg:inline-flex"
      : "inline-flex h-11 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 text-[15px] font-semibold text-[var(--tv-body)] transition-colors hover:text-[var(--tv-brand-deep)]",
    variant === "hero"
      ? en
        ? "w-[208px]"
        : "w-[180px]"
      : en
        ? "w-[128px]"
        : "w-[109px]",
    FOCUS
  );
  if (target === null) {
    return (
      <button
        type="button"
        disabled
        aria-busy="true"
        aria-label={t("checking")}
        className={className}
      >
        <LoaderCircle
          aria-hidden
          className="size-[18px] animate-spin motion-reduce:animate-none"
        />
      </button>
    );
  }
  const label =
    variant === "nav"
      ? t("app")
      : target.os === "mac"
        ? t("mac")
        : target.os === "windows"
          ? t("windows")
          : t("app");
  return (
    <a
      href={
        target.os === "other" ? localePath(locale, target.href) : target.href
      }
      target={target.os === "other" ? undefined : "_blank"}
      rel={target.os === "other" ? undefined : "noopener noreferrer"}
      className={className}
      onClick={target.os === "other" ? undefined : startDownload}
    >
      {variant === "hero" ? <PlatformIcon os={target.os} /> : null}
      {label}
    </a>
  );
}
