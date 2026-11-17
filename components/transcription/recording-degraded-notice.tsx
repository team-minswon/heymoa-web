"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

export function RecordingDegradedNotice() {
  const t = useTranslations("recording.degraded");
  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] px-3 py-1.5 text-[13px] text-[var(--el-ink)] shadow-e2 backdrop-blur-xl"
    >
      <AlertTriangle className="size-4 shrink-0 text-amber-600" />
      <span>
        {t("title")}{" "}
        <span className="text-[var(--el-muted)]">{t("detail")}</span>
      </span>
    </div>
  );
}
