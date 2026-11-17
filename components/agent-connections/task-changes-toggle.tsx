"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function TaskChangesToggle({
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("agents.taskChanges");
  const labelId = useId();
  return (
    <div className={cn("grid gap-2 text-left", className)}>
      <div className="flex items-center justify-between gap-3">
        <span id={labelId} className="text-sm font-medium text-[var(--el-ink)]">
          {t("label")}
        </span>
        <Switch
          aria-labelledby={labelId}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {checked ? (
        <ul className="space-y-1 text-xs leading-relaxed text-[var(--el-muted)]">
          <li>{t("effect")}</li>
          <li>{t("irreversible")}</li>
        </ul>
      ) : null}
    </div>
  );
}
