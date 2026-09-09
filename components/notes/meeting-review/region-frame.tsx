"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

import type { RegionStatus } from "@/lib/notes/meeting-review/contract";
import { presentRegion } from "@/lib/notes/meeting-review/select";
import { cn } from "@/lib/utils";

/**
 * 영역 하나의 틀. 제목은 늘 그리고(라벨은 기다리는 것이 아니다), 준비 상태에 따라 본문
 * 자리에 기다림·빈 상태·실패를 그린다. 오래됨은 본문을 그대로 두고 배지만 붙인다 —
 * 읽던 내용을 가리지 않는다(`error-loading.md`).
 *
 * 기다림은 spinner + 한 줄이다. 끝나는 시각을 모르는 서버 작업이라 skeleton 의 「곧 온다」
 * 약속을 할 수 없다.
 */
export function RegionFrame({
  title,
  status,
  waitingLabel,
  emptyLabel,
  failedLabel,
  aside,
  children,
  testId,
}: {
  title: string;
  status: RegionStatus;
  waitingLabel: string;
  emptyLabel: string;
  failedLabel: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}) {
  const presentation = presentRegion(status);
  return (
    <section data-testid={testId} data-region-status={status} className="space-y-3">
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--el-hairline)] pb-2">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--el-ink)]">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {presentation.kind === "ready" && presentation.stale ? (
            <StatusChip tone="warn">오래됨</StatusChip>
          ) : null}
          {aside}
        </div>
      </header>
      {presentation.kind === "waiting" ? (
        <p
          role="status"
          className="flex items-center gap-2 text-[13px] text-[var(--el-muted)]"
        >
          <Loader2 aria-hidden className="size-3.5 animate-spin" />
          {waitingLabel}
        </p>
      ) : presentation.kind === "empty" ? (
        <p className="text-[13px] text-[var(--el-muted-soft)]">{emptyLabel}</p>
      ) : presentation.kind === "failed" ? (
        <div
          role="alert"
          className="flex gap-2.5 rounded-block border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] p-3"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--el-error)]" />
          <p className="text-[13px] text-[var(--el-ink)]">{failedLabel}</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** 작은 상태 칩. 「검토본」「확정됨」「AI 해석」처럼 뜻을 못박는 자리에만 쓴다. */
export function StatusChip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "warn" | "error" | "ok" | "ai";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[20px] items-center rounded-[6px] border px-1.5 text-[11px] font-medium leading-none",
        tone === "neutral" && "border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] text-[var(--el-muted)]",
        tone === "warn" && "border-[var(--el-highlight)]/60 bg-[var(--el-highlight)]/30 text-[var(--el-ink)]",
        tone === "error" && "border-[var(--el-error)]/30 bg-[var(--el-error)]/10 text-[var(--el-error-strong)]",
        tone === "ok" && "border-[var(--el-success)]/30 bg-[var(--el-success)]/10 text-[var(--el-ink)]",
        tone === "ai" && "border-[var(--el-hairline)] bg-[var(--el-surface-card)] text-[var(--el-muted)] italic",
        className
      )}
    >
      {children}
    </span>
  );
}
