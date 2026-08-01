"use client";

import { ArrowLeft, PanelRight, Shrink } from "lucide-react";

import { AvatarStack } from "@/components/workspace/page-chrome";
import { NotificationBell } from "@/components/notification/notification-bell";
import type { NoteResponseData } from "@/lib/api/generated/models";
import { formatAppDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";

/**
 * full 회의 화면의 머리. design.pen `mX3uZ` 기준으로 세 켜다:
 *
 *   Top Bar(h56)   ← 목록으로 · ⤡ side로 │ 제목            🔔 · 레일 토글
 *   Note Header    상태·프로젝트 / 34px 제목 / 아바타 + 메타 / 탭
 *   Content        p 24 · 본문 폭 660 중앙
 *
 * 본문 폭을 660으로 묶는 게 핵심이다 — 930 폭을 다 쓰면 전사 한 줄이 너무 길어 눈이 줄을 잃는다.
 */

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "시작 전",
  IN_PROGRESS: "기록 중",
  PAUSED: "중지됨",
  ENDED: "종료됨",
};

export function NoteTopBar({
  title,
  onBack,
  onShrink,
  shrinkLabel = "옆에 열기",
  shrinkDisabled = false,
  onToggleRail,
  railOpen,
  actions,
}: {
  title: string;
  onBack: () => void;
  onShrink?: () => void;
  /** side ↔ full 을 오가는 버튼의 이름. 방향에 따라 말이 반대다. */
  shrinkLabel?: string;
  shrinkDisabled?: boolean;
  onToggleRail?: () => void;
  railOpen?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--el-hairline)] px-4 sm:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <IconButton label="목록으로" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </IconButton>
        {onShrink ? (
          <IconButton
            label={shrinkLabel}
            disabled={shrinkDisabled}
            onClick={onShrink}
          >
            <Shrink className="size-4" />
          </IconButton>
        ) : null}
        <span className="h-[18px] w-px shrink-0 bg-[var(--el-hairline)]" />
        <span className="truncate text-[13px] font-semibold text-[var(--el-ink)]">
          {title}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <NotificationBell />
        {onToggleRail ? (
          <IconButton
            label={railOpen ? "레일 닫기" : "레일 열기"}
            bordered
            pressed={railOpen}
            onClick={onToggleRail}
          >
            <PanelRight className="size-4" />
          </IconButton>
        ) : null}
      </div>
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  bordered = false,
  pressed,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  bordered?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-control text-[var(--el-muted)] transition-colors hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)] disabled:pointer-events-none disabled:opacity-40",
        bordered && "border border-[var(--control-border)]",
        pressed && "bg-[var(--el-surface-strong)] text-[var(--el-ink)]"
      )}
    >
      {children}
    </button>
  );
}

/** 본문 폭 제한 — 머리와 내용이 같은 좌우 기준선에 서야 한 장으로 읽힌다. */
export function NoteColumn({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[660px]", className)}>
      {children}
    </div>
  );
}

export function NoteHeader({
  note,
  projectName,
  children,
}: {
  note?: NoteResponseData;
  projectName?: string;
  children?: React.ReactNode;
}) {
  const live = note?.meetingStatus === "IN_PROGRESS";
  const meta = note ? buildMeta(note) : null;

  return (
    <header className="shrink-0 border-b border-[var(--el-hairline)] px-4 pt-5 pb-4 sm:px-8">
      <NoteColumn className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {note ? (
              <span
                data-testid="meeting-status"
                className="flex items-center gap-1.5 text-[11px] font-semibold"
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    live ? "bg-[var(--el-error)]" : "bg-[var(--el-muted)]"
                  )}
                />
                <span
                  className={
                    live
                      ? "text-[var(--el-error)]"
                      : "text-[var(--el-muted)]"
                  }
                >
                  {STATUS_LABEL[note.meetingStatus] ?? note.meetingStatus}
                </span>
              </span>
            ) : null}
            {projectName ? (
              <span className="rounded-full border border-[var(--el-hairline)] px-2 text-center text-[12px]/[16px] font-semibold text-[var(--el-ink)]">
                {projectName}
              </span>
            ) : null}
          </div>
          <h1 className="truncate font-serif text-[34px] leading-[41px] font-light tracking-[-0.8px] text-[var(--el-ink)]">
            {note?.title ?? "회의"}
          </h1>
          {note ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <AvatarStack people={note.participants ?? []} />
              <p className="text-[12px] leading-[19px] text-[var(--el-body)]">
                {meta}
              </p>
            </div>
          ) : null}
        </div>
        {children}
      </NoteColumn>
    </header>
  );
}

function buildMeta(note: NoteResponseData): React.ReactNode {
  const parts: string[] = [];
  const people = note.participants?.length ?? 0;
  if (people > 0) parts.push(`참석자 ${people}명`);
  // 「언제」는 시작 시각 → 예정 → 생성 순으로 떨어진다. 셋 다 없는 노트는 계약상 없다.
  const when = note.meetingStartedAt ?? note.scheduledAt ?? note.createdAt;
  const minutes = Math.floor((note.recordedDurationMs ?? 0) / 60_000);

  return (
    <>
      {parts.length > 0 ? `${parts.join(" · ")} · ` : null}
      {/* 시각은 기계도 읽는다 — 표시 문자열만 두면 캘린더·스크린리더가 못 집는다. */}
      {when ? (
        <time dateTime={when}>
          {formatAppDate(when, {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </time>
      ) : null}
      {minutes > 0 ? (
        <>
          <br />
          {`기록 ${minutes}분 (종료 세션 누적)`}
        </>
      ) : null}
    </>
  );
}

/** 회의 안 탭 — 회색 트랙 위 흰 활성 칩. 목록의 세그먼트와 같은 형태다. */
export function NoteTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { key: T; label: string }[];
  onChange: (key: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="회의 보기"
      className="flex h-10 w-fit items-center gap-1 rounded-control bg-[var(--el-surface-strong)] p-1"
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={value === option.key}
          onClick={() => onChange(option.key)}
          className={cn(
            "rounded-chip px-3 py-1.5 text-[14px]/[20px] font-medium transition-colors",
            value === option.key
              ? "bg-[var(--el-canvas)] text-[var(--el-ink)]"
              : "text-[var(--el-muted)] hover:text-[var(--el-ink)]"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** 요약 섹션 — 아이콘 + 굵은 제목, 그 아래 테두리 블록. */
export function NoteSection({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--el-ink)]">
        <Icon className="size-3.5 text-[var(--el-muted)]" />
        {label}
      </h2>
      <div className="flex flex-col gap-1.5 rounded-control border border-[var(--el-hairline)] bg-card px-4 py-3.5 text-[13px]/[22px] text-[var(--el-ink)]">
        {children}
      </div>
    </section>
  );
}
