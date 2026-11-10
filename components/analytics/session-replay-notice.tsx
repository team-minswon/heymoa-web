"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import { SESSION_REPLAY_EFFECTIVE } from "@/lib/analytics/session-replay";

/** 처리방침 제12조의 서비스 화면 공고. 시행 뒤에는 사라집니다. */
export function SessionReplayNotice() {
  const [dismissed, setDismissed] = useState(
    () => Date.now() >= Date.parse(`${SESSION_REPLAY_EFFECTIVE}T00:00:00+09:00`)
  );
  const locale = useLocale();
  const t = useTranslations("legal.ui");
  if (dismissed) return null;

  return (
    <aside className="fixed bottom-4 left-4 z-40 flex max-w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-lg border border-border bg-background p-4 text-sm shadow-sm">
      <div className="min-w-0 space-y-2 leading-relaxed [word-break:keep-all]">
        <p>{t("replayNotice")}</p>
        <a
          className="font-medium underline underline-offset-4"
          href={`${locale === "en" ? "/en" : ""}/privacy#session-replay-changes`}
        >
          {t("replayNoticeLink")}
        </a>
      </div>
      <button
        type="button"
        className="shrink-0 rounded p-1 hover:bg-muted focus-visible:outline-2"
        aria-label={t("replayNoticeDismiss")}
        onClick={() => setDismissed(true)}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
