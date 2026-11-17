import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export function AgentAccessNotice({
  allowTaskChanges = false,
  className,
}: {
  allowTaskChanges?: boolean;
  className?: string;
}) {
  const t = useTranslations("agents.accessNotice");
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-block bg-[var(--el-canvas-soft)] p-3.5 text-left text-xs",
        className
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]" />
      <ul className="space-y-1 leading-relaxed text-[var(--el-muted)]">
        <li>{t("allProjects")}</li>
        <li>{t("transcripts")}</li>
        <li>
          {allowTaskChanges ? t("readAndTasks") : t("readOnly")}{" "}
          {t("sameView")}
        </li>
        <li>{t("expiry")}</li>
      </ul>
    </div>
  );
}
