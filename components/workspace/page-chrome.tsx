"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 패널 안 페이지의 공통 크롬. design.pen의 모든 콘텐츠 화면이 같은 뼈대를 쓴다:
 *
 *   Top Bar(h56) — 셸이 그림
 *   Page Head    p 24/32/16/32 · 34px 세리프 제목 + 12px 설명 | 오른쪽 액션
 *   Filters      p 0/32/16/32 · gap 8
 *   Body         p 0/32/28/32 · flex-1
 *
 * 페이지마다 이 값을 다시 적으면 한 화면만 32가 아니게 되는 것을 아무도 못 잡는다.
 */

/** 셸이 overflow-hidden 이라 스크롤 경계는 페이지가 만든다. */
export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHead({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 px-8 pt-6 pb-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate font-serif text-[34px] leading-[41px] font-light tracking-[-0.8px] text-[var(--el-ink)]">
          {title}
        </h1>
        {description ? (
          <p className="truncate text-[12px] text-[var(--el-body)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/**
 * 설정 화면의 머리. 제품 화면과 둘이 다르다 — 설정은 상단바가 없어서 이 머리가 그 자리를
 * 겸하고(아래 hairline), 제목이 26px 이다. 34px 은 「어디에 있나」를 말하는 자리의 크기다.
 */
export function SettingsHead({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--el-hairline)] px-8 pt-6 pb-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="font-serif text-note-title leading-[31px] font-light tracking-[-0.8px] text-[var(--el-ink)]">
          {title}
        </h1>
        {description ? (
          <p className="text-[12px] leading-[19px] text-[var(--el-body)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/** 설정 본문 — 폼 최대 폭 880. 더 넓으면 한 줄 라벨과 입력이 서로를 못 찾는다. */
export function SettingsBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex w-full max-w-[880px] flex-col gap-5 px-8 py-6">
        {children}
      </div>
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 px-8 pb-4">
      {children}
    </div>
  );
}

/** 본문 영역. 시트가 여기 들어간다. */
export function PageContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-1 flex-col px-8 pb-7", className)}>
      {children}
    </div>
  );
}

/** 흰 시트 — radius 16 · hairline. 패널 안에 한 겹 더 얹는 유일한 면이다. */
export function Sheet({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-card",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * 아무것도 없거나 못 불러왔을 때 본문이 되는 면. 테두리 박스가 아니라 **본문을 채우고
 * 가운데 정렬**한다 — 빈 화면에 작은 상자를 놓으면 그 상자가 콘텐츠처럼 읽힌다(design.pen).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <Icon className="size-8 text-[var(--el-muted)]" />
      <h2 className="font-serif text-note-title leading-[31px] font-light tracking-[-0.8px] text-[var(--el-ink)]">
        {title}
      </h2>
      {description ? (
        <p className="max-w-[440px] text-[14px] leading-[23px] text-[var(--el-body)]">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}

/** 세그먼트 탭 — 회색 트랙 위에 흰 활성 칩. */
export function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { key: T; label: string }[];
  onChange: (key: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-1 rounded-control bg-[var(--el-surface-strong)] p-1"
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
          className={cn(
            "h-8 rounded-chip px-3 text-[12px] transition-colors",
            value === option.key
              ? "bg-card font-semibold text-[var(--el-ink)]"
              : "font-medium text-[var(--el-muted)] hover:text-[var(--el-ink)]"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** 아웃라인 컨트롤(h36) — 셀렉트/드롭다운 트리거의 공통 형태. */
export function ControlChip({
  icon: Icon,
  label,
  active = false,
  className,
  ...rest
}: {
  icon?: LucideIcon;
  label: string;
  active?: boolean;
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-control border border-[var(--control-border)] px-2.5 text-[12px] transition-colors hover:bg-[var(--el-surface-strong)]",
        active
          ? "font-medium text-[var(--el-ink)]"
          : "font-normal text-[var(--el-body)]",
        className
      )}
    >
      {Icon ? <Icon className="size-3.5 text-[var(--el-muted)]" /> : null}
      {label}
      <ChevronDown className="size-3.5 text-[var(--el-muted)]" />
    </button>
  );
}

/** 검색 인풋(w260 h36). */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-9 w-[260px] max-w-full items-center gap-2 rounded-control border border-[var(--control-border)] px-2.5 focus-within:border-[var(--el-ink)]",
        className
      )}
    >
      <Search className="size-3.5 shrink-0 text-[var(--el-muted)]" />
      <input
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--el-ink)] outline-none placeholder:text-[var(--el-body)] [&::-webkit-search-cancel-button]:appearance-none"
      />
    </div>
  );
}

/** 참석자 아바타 스택 — 24px 원, -6 겹침, 흰 아웃라인으로 서로를 자른다. */
export function AvatarStack({
  people,
  max = 3,
}: {
  people: readonly { userId: string; name: string }[];
  max?: number;
}) {
  if (people.length === 0) {
    return <span className="text-[12px] text-[var(--el-muted)]">—</span>;
  }
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((person) => (
        <span
          key={person.userId}
          title={person.name}
          className="flex size-6 items-center justify-center rounded-full bg-[var(--el-surface-strong)] text-[11px] font-semibold text-[var(--el-body)] outline-2 outline-[var(--el-surface-card)]"
        >
          {person.name.trim().slice(0, 1)}
        </span>
      ))}
      {rest > 0 ? (
        <span className="flex size-6 items-center justify-center rounded-full bg-[var(--el-surface-strong)] text-[10px] font-semibold text-[var(--el-body)] outline-2 outline-[var(--el-surface-card)]">
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
