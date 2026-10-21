"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { desktopDownload } from "@/lib/desktop/downloads";

/** 워크스페이스에서 연 새 설치 안내 탭 안에서만 다운로드를 시작합니다. `title` 은 숨은 iframe 의 이름(페이지 언어)입니다. */
export function DesktopAutoDownload({
  title = "HeyMoa 설치 파일 다운로드",
}: {
  title?: string;
}) {
  const query = useSearchParams();
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    if (query.get("start") !== "1") return;
    let active = true;
    void desktopDownload(navigator).then((target) => {
      if (active && target.os !== "other" && target.href) setHref(target.href);
    });
    return () => {
      active = false;
    };
  }, [query]);
  return href ? (
    <iframe
      hidden
      aria-hidden
      title={title}
      src={href}
      referrerPolicy="no-referrer"
    />
  ) : null;
}
