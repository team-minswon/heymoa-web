"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * 연결에 할 일 쓰기를 맡길지(APP-1369). 새 연결과 OAuth 동의가 같이 쓴다. 기본은 꺼짐이고, server 가 만든 뒤에는
 * 바꾸지 않으므로(APP-1461) 켜는 그 자리에서 무엇이 달라지는지와 되돌릴 수 없다는 것을 함께 말한다.
 */
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
