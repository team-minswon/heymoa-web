import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** 조회 실패 인라인 표시. 페이지 전체 error.tsx보다 좁은, 위젯 단위 실패용. */
export function InlineRetry({
  onRetry,
  label = "불러오지 못했습니다",
}: {
  onRetry: () => void;
  label?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-6 py-8 text-center"
    >
      <AlertTriangle className="size-5 text-[var(--el-error)]" />
      <p className="text-sm text-[var(--el-muted)]">{label}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCcw className="size-4" />
        다시 시도
      </Button>
    </div>
  );
}
