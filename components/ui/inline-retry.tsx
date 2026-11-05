import { AlertTriangle, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 조회 실패 인라인 표시. 페이지 전체 error.tsx보다 좁은, 위젯 단위 실패용.
 * `line` 은 목록 · 섹션 안에서 한 줄로 서는 모양이다 — 큰 상자가 줄 사이에 끼면 읽던 흐름이 끊긴다.
 */
export function InlineRetry({
  onRetry,
  label,
  variant = "block",
  className,
}: {
  onRetry: () => void;
  label?: string;
  variant?: "block" | "line";
  className?: string;
}) {
  const t = useTranslations("common");
  const text = label ?? t("loadFailed");
  if (variant === "line") {
    return (
      <p
        role="alert"
        className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--el-ink)]", className)}
      >
        {text}
        <Button variant="outline" size="sm" className="h-[26px]" onClick={onRetry}>
          {t("actions.retry")}
        </Button>
      </p>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-6 py-8 text-center",
        className
      )}
    >
      <AlertTriangle className="size-5 text-[var(--el-error)]" />
      <p className="text-sm text-[var(--el-muted)]">{text}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCcw className="size-4" />
        {t("actions.retry")}
      </Button>
    </div>
  );
}
