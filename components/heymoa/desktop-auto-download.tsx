"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { desktopDownload } from "@/lib/desktop/downloads";

export function DesktopAutoDownload({ title }: { title: string }) {
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
