"use client";

import { ChevronsRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type RailTab = "note" | "agent";

/**
 * 우측 레일의 머리. design.pen 기준으로 **두 챗봇이 한 레일을 나눠 쓴다** —
 * 「이 회의」(멤버가 함께 보는 회의 챗봇)와 「내 에이전트」(나만 보는 워크스페이스 챗봇).
 *
 * 탭은 **감추기**로만 오간다. 언마운트하면 흐르던 스트림이 끊기고 계약상 부분 응답은
 * 저장되지 않아 답변이 통째로 사라진다 — 그래서 두 패널은 각자 마운트된 채로 남고
 * 여기서는 어느 쪽이 보일지만 고른다.
 */
export function RailTabs({
  active,
  onSelect,
  onClose,
  noteBadge,
  hasNoteTab = true,
}: {
  active: RailTab;
  onSelect: (tab: RailTab) => void;
  onClose: () => void;
  /** 「이 회의」에 붙는 빨간 수 — 안 읽은 답변이 있을 때만. */
  noteBadge?: number;
  /** 회의 밖(워크스페이스 스코프)에서는 건너갈 회의 챗봇이 없다. */
  hasNoteTab?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--el-hairline)] px-3.5 py-3">
      <div
        role="tablist"
        aria-label="레일"
        className="flex items-center gap-1 rounded-control bg-[var(--el-surface-strong)] p-1"
      >
        {hasNoteTab ? (
          <RailTabButton
            active={active === "note"}
            badge={noteBadge}
            onClick={() => onSelect("note")}
          >
            이 회의
          </RailTabButton>
        ) : null}
        <RailTabButton
          active={active === "agent"}
          onClick={() => onSelect("agent")}
        >
          내 에이전트
        </RailTabButton>
      </div>
      <button
        type="button"
        aria-label="레일 닫기"
        onClick={onClose}
        className="flex size-8 shrink-0 items-center justify-center rounded-control text-[var(--el-muted)] transition-colors hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)]"
      >
        <ChevronsRight className="size-4" />
      </button>
    </div>
  );
}

function RailTabButton({
  active,
  badge,
  onClick,
  children,
}: {
  active: boolean;
  badge?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-chip px-2.5 text-[12px] transition-colors",
        active
          ? "bg-card font-semibold text-[var(--el-ink)]"
          : "font-medium text-[var(--el-muted)] hover:text-[var(--el-ink)]"
      )}
    >
      {children}
      {badge && badge > 0 ? (
        <span className="rounded-full bg-[var(--el-error)] px-1.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/** 이 대화를 누가 보는지 한 줄. 공유와 개인이 한 자리를 쓰므로 매번 밝힌다. */
export function RailScopeBar({
  icon: Icon,
  children,
  trailing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-[var(--el-hairline)] px-3.5 py-2.5">
      <Icon className="size-3.5 shrink-0 text-[var(--el-muted)]" />
      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[var(--el-body)]">
        {children}
      </span>
      {trailing}
    </div>
  );
}
