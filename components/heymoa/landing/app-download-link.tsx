"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { track } from "@/lib/analytics/track";
import { desktopDownload } from "@/lib/desktop/downloads";
import { cn } from "@/lib/utils";
import { FOCUS } from "./tokens";
import { PlatformIcon } from "@/components/heymoa/desktop-platform-icon";

export function AppDownloadLink({
  variant = "hero",
}: {
  variant?: "hero" | "nav";
}) {
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
    // 별도 다운로드 탐색으로 시작해야 안내 페이지 이동이 파일 요청을 취소하지 않습니다.
    window.open(event.currentTarget.href, "_blank", "noopener,noreferrer");
    track("desktop_download_clicked");
    router.push("/download");
  }

  const className = cn(
    variant === "hero"
      ? "hidden h-[52px] w-[180px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[var(--tv-rule-strong)] bg-white px-2 text-[14px] font-bold text-[var(--tv-ink)] transition-colors hover:bg-[var(--tv-lav-soft)] lg:inline-flex"
      : "inline-flex h-11 w-[109px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 text-[15px] font-semibold text-[var(--tv-body)] transition-colors hover:text-[var(--tv-brand-deep)]",
    FOCUS
  );
  if (target === null) {
    return (
      <button
        type="button"
        disabled
        aria-busy="true"
        aria-label="앱 다운로드 확인 중"
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
      ? "앱 다운로드"
      : target.os === "mac"
        ? "macOS 다운로드"
        : target.os === "windows"
          ? "Windows 다운로드"
          : "앱 다운로드";
  return (
    <a
      href={target.href}
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
