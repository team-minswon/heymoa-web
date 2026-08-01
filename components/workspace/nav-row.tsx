"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 사이드바 행의 단 하나뿐인 형태. design.pen 기준:
 * h34 = [2px 활성 마크] + [flex-1 행 · h34 · gap8 · px10 · radius 8].
 *
 * 마크가 행 **밖**에 있는 게 핵심이다 — 안에 넣으면 활성 배경(흰색)이 마크까지 덮어
 * 캔버스 위에서 마크가 사라진다.
 */
export function NavRow({
  icon: Icon,
  leading,
  label,
  active = false,
  onClick,
  trailing,
  tone = "default",
  className,
  ...rest
}: {
  icon?: LucideIcon;
  /** 아이콘 대신 놓는 것 — 라이브 행의 빨간 점처럼. */
  leading?: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  trailing?: React.ReactNode;
  tone?: "default" | "live";
  className?: string;
} & Omit<React.ComponentProps<"button">, "onClick" | "ref">) {
  const live = tone === "live";

  return (
    <div
      className={cn(
        "group/nav-row relative flex h-[34px] w-full items-center",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-[18px] w-[2px] shrink-0 rounded-full",
          active && "bg-[var(--el-ink)]"
        )}
      />
      <button
        type="button"
        onClick={onClick}
        {...rest}
        className={cn(
          "flex h-[34px] min-w-0 flex-1 items-center gap-2 rounded-control px-2.5 text-left transition-colors",
          live
            ? "bg-[var(--el-error-bg)]"
            : active
              ? "bg-card"
              : "hover:bg-[var(--el-surface-strong)]"
        )}
      >
        {leading}
        {Icon ? (
          <Icon
            className={cn(
              "size-4 shrink-0",
              active ? "text-[var(--el-ink)]" : "text-[var(--el-muted)]"
            )}
          />
        ) : null}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px]",
            live
              ? "font-semibold text-[var(--el-error-strong)]"
              : active
                ? "font-semibold text-[var(--el-ink)]"
                : "font-normal text-[var(--el-body)]"
          )}
        >
          {label}
        </span>
        {trailing}
      </button>
    </div>
  );
}

/** 사이드바 그룹 제목 — 10px bold, tracking 0.9. */
export function NavGroupLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex w-full items-center justify-between px-3 pt-2 pb-1.5">
      <span className="text-[10px] font-bold tracking-[0.9px] text-[var(--el-muted)]">
        {children}
      </span>
      {action}
    </div>
  );
}
