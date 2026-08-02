import { cn } from "@/lib/utils";

/**
 * 설정 다이얼로그 본문의 규격. 값은 design.pen `LS24B` 실측이다.
 *
 * - 섹션 머리 h34, 왼쪽 제목(13/600) · 오른쪽 주석(11)
 * - 행 h58, gap 16, `[이름 13 + 설명 11.5]` … `[컨트롤]`, 아래 hairline
 * - 그룹의 **마지막 행은 선이 없다** — 있으면 섹션 사이 여백에 선이 떠 있는 것으로 읽힌다
 * - 저장 버튼이 없다. 컨트롤을 바꾸면 그 자리에서 저장한다
 */
export function SettingsSection({
  title,
  note,
  count,
  action,
  children,
}: {
  title: string;
  note?: string;
  /** 제목 **옆**에 붙는다. 오른쪽으로 보내면 액션과 섞여 가운데 떠 있는 것으로 읽힌다. */
  count?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="w-full">
      <header className="flex h-[34px] items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold text-[var(--el-ink)]">
            {title}
          </h3>
          {count ? (
            <span className="text-[11px] text-[var(--el-muted)]">{count}</span>
          ) : null}
        </div>
        {action ??
          (note ? (
            <p className="text-[11px] text-[var(--el-muted)]">{note}</p>
          ) : null)}
      </header>
      <div className="flex w-full flex-col [&>*:last-child]:border-b-0">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  icon,
  children,
  className,
  ...props
}: {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
} & React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-[58px] w-full items-center gap-4 border-b border-[var(--el-hairline)]",
        className
      )}
      {...props}
    >
      {icon ? (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-control bg-[var(--el-surface-strong)]">
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-[13px] text-[var(--el-ink)]">{label}</span>
        {description ? (
          <span className="text-[11px] text-[var(--el-muted)]">
            {description}
          </span>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

/** 섹션 사이 28. design.pen 의 `sp` 프레임이다. */
export function SettingsGap() {
  return <div aria-hidden className="h-7 w-px shrink-0" />;
}
