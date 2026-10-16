"use client";

import { CircleHelp, MonitorDown, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { DesktopCompareDialog } from "@/components/workspace/desktop-compare-dialog";
import { track } from "@/lib/analytics/track";
import { useDesktopApp } from "@/lib/desktop/use-desktop-app";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "heymoa:desktop-promo-dismissed";

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 브라우저로 쓰는 사람에게 데스크톱 앱이 있다고 알린다. 앱은 마이크에 더해 컴퓨터에서 나는 소리까지
 * 녹음하므로 온라인 회의를 기록하려는 사람에게 필요하다.
 *
 * **앱 안에서는 그리지 않는다.** `useDesktopApp()` 은 하이드레이션 동안 `null` 이라 `=== false` 일 때만
 * 그린다(앱 안에서 한 번 보였다 사라지지 않게). 모바일 폭에서도 숨긴다 — 설치할 수 없는 기기다.
 *
 * 닫음은 이 브라우저에만 남는다. 저장이 막혀도 화면은 정상이고 다음 방문에 다시 보일 뿐이다.
 * 말하는 수준은 도움말(`/help/desktop`)과 같다 — 특정 화상회의 앱 지원은 약속하지 않는다.
 */
export function DesktopAppPromo() {
  const isDesktopApp = useDesktopApp();
  // 첫 렌더에서는 닫았는지 모른다 — 읽기 전에 그리면 닫은 사람에게 카드가 번쩍인다.
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  if (dismissed === null && typeof window !== "undefined") {
    setDismissed(wasDismissed());
  }

  if (isDesktopApp !== false || dismissed !== false) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // 저장은 편의일 뿐이다.
    }
    setDismissed(true);
  };

  return (
    <aside
      aria-label="데스크톱 앱 안내"
      className="mb-5 hidden items-center gap-4 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] py-3.5 pr-3 pl-4 md:flex"
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--el-surface-strong)] text-[var(--el-ink)]"
      >
        <MonitorDown className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--el-ink)]">
          온라인 회의도 기록하세요
        </p>
        <p className="mt-0.5 text-sm leading-6 break-keep text-pretty text-[var(--el-muted)]">
          데스크톱 앱은 컴퓨터에서 나는 소리까지 녹음해, 화상회의 상대방의
          목소리도 담을 수 있습니다.
        </p>
      </div>
      <Link
        href="/download"
        onClick={() => track("desktop_download_clicked")}
        className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
      >
        데스크톱 앱 받기
      </Link>
      <button
        type="button"
        aria-label="웹과 데스크톱 앱의 차이 보기"
        title="웹과 뭐가 다른가요?"
        onClick={() => setCompareOpen(true)}
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-control text-[var(--el-muted)] transition-colors hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <CircleHelp aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        aria-label="데스크톱 앱 안내 닫기"
        onClick={dismiss}
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-control text-[var(--el-muted)] transition-colors hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <X aria-hidden className="size-4" />
      </button>
      <DesktopCompareDialog open={compareOpen} onOpenChange={setCompareOpen} />
    </aside>
  );
}
