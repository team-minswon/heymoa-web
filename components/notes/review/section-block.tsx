import type { ReactNode } from "react";

export function SectionBlock({
  title,
  count,
  aside,
  children,
}: {
  title: string;
  count?: number;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="pt-11 first:pt-0">
      <div className="flex h-7 items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-[7px] text-base font-semibold text-[var(--el-ink)]">
          {title}
          {count === undefined ? null : (
            <span className="text-[13px] font-normal tabular-nums text-[var(--el-muted-soft)]">
              {count}
            </span>
          )}
        </h2>
        {aside}
      </div>
      <div className="mt-2 min-w-0">{children}</div>
    </section>
  );
}
