"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { PlatformIcon } from "@/components/heymoa/desktop-platform-icon";
import { track } from "@/lib/analytics/track";
import { desktopDownload } from "@/lib/desktop/downloads";
import { cn } from "@/lib/utils";
import { localePath } from "@/lib/i18n/locales";

export function DesktopDownloadLink({ className }: { className?: string }) {
  const t = useTranslations("shell.desktopDownload");
  const locale = useLocale();
  const [os, setOs] = useState<"mac" | "windows" | "other" | null>(null);
  useEffect(() => {
    let active = true;
    void desktopDownload(navigator).then((target) => {
      if (active) setOs(target.os);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <a
      href={localePath(locale, "/download?start=1")}
      target="_blank"
      rel="noopener noreferrer"
      aria-busy={os === null || undefined}
      aria-label={os === null ? t("checking") : undefined}
      onClick={() => track("desktop_download_clicked")}
      className={cn(
        "inline-flex h-8 w-fit min-w-11 shrink-0 items-center justify-center gap-2 px-3 whitespace-nowrap",
        className
      )}
    >
      {os === null ? (
        <LoaderCircle
          aria-hidden
          className="size-[18px] animate-spin motion-reduce:animate-none"
        />
      ) : (
        <>
          <span className="inline-flex shrink-0 [&_svg]:size-[22px]">
            <PlatformIcon os={os} />
          </span>
          {os === "mac"
            ? t("mac")
            : os === "windows"
              ? t("windows")
              : t("other")}
        </>
      )}
    </a>
  );
}
