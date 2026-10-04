import type { ReactNode } from "react";

import { CopyMarkdownButton } from "@/components/notes/copy-markdown-button";

/**
 * 검토 화면의 한 덩어리. 회의록 문서처럼 한 단으로 흐른다(APP-865) — 제목 옆에 회색 개수,
 * 오른쪽 끝에 복사, 그 아래 내용이다. [copy] 를 주면 복사가 선다.
 */
export function SectionBlock({
  title,
  count,
  copy,
  children,
}: {
  title: string;
  count?: number;
  copy?: { build: () => string; disabled?: boolean };
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
        {copy ? (
          <CopyMarkdownButton
            label={title}
            build={copy.build}
            disabled={copy.disabled}
            iconOnly
            className="size-7 text-[var(--el-muted-soft)] hover:text-[var(--el-ink)]"
          />
        ) : null}
      </div>
      <div className="mt-2 min-w-0">{children}</div>
    </section>
  );
}
