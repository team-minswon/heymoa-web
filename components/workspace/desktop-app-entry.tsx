"use client";

import { CircleHelp, MonitorDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DesktopCompareDialog } from "@/components/workspace/desktop-compare-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { track } from "@/lib/analytics/track";
import { useDesktopApp } from "@/lib/desktop/use-desktop-app";

/**
 * 사이드바의 「데스크톱 앱 받기」. 누르면 다운로드 안내로 가고, hover 하면 무엇이 되는지 말한다.
 * 옆 도움말(ⓘ)은 웹과 앱이 무엇이 다른지를 세 장으로 보여 주는 창을 연다.
 *
 * **앱 안에서는 그리지 않는다.** `useDesktopApp()` 은 하이드레이션 동안 `null` 이라 `=== false` 일 때만
 * 그린다(앱 안에서 한 번 보였다 사라지지 않게). `TooltipProvider` 는 셸이 이미 건다.
 */
export function DesktopAppEntry() {
  const isDesktopApp = useDesktopApp();
  const [compareOpen, setCompareOpen] = useState(false);

  if (isDesktopApp !== false) return null;

  return (
    <div className="flex items-center gap-1 border-t border-[var(--el-hairline)] px-3 py-2">
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href="/download"
              onClick={() => track("desktop_download_clicked")}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-2 py-2 text-[13px] font-medium text-[var(--el-ink)] transition-colors hover:bg-[var(--el-surface-strong)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          }
        >
          <MonitorDown aria-hidden className="size-4 shrink-0 text-[var(--el-muted)]" />
          <span className="truncate">데스크톱 앱 받기</span>
        </TooltipTrigger>
        <TooltipContent side="top">온라인 회의도 녹음할 수 있어요</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="웹과 데스크톱 앱의 차이 보기"
              onClick={() => setCompareOpen(true)}
              className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-control text-[var(--el-muted)] transition-colors hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          }
        >
          <CircleHelp aria-hidden className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="top">웹과 뭐가 다른가요?</TooltipContent>
      </Tooltip>
      <DesktopCompareDialog open={compareOpen} onOpenChange={setCompareOpen} />
    </div>
  );
}
