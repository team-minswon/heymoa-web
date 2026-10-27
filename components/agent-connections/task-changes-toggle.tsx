"use client";

import { useId } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const LABEL = "할 일 만들기·고치기 허용";

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
  const labelId = useId();
  return (
    <div className={cn("grid gap-2 text-left", className)}>
      <div className="flex items-center justify-between gap-3">
        <span id={labelId} className="text-sm font-medium text-[var(--el-ink)]">
          {LABEL}
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
          <li>
            이 연결의 앱이 내 이름으로 할 일을 만들고 고칩니다. 바꾸기 전에
            묻지 않습니다. 결정과 회의 검토는 바꾸지 않습니다.
          </li>
          <li>허용은 연결을 만든 뒤 바꿀 수 없습니다. 바꾸려면 새로 연결합니다.</li>
        </ul>
      ) : null}
    </div>
  );
}
