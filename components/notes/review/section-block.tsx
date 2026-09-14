import type { ReactNode } from "react";

import { CopyMarkdownButton } from "@/components/notes/copy-markdown-button";

/**
 * 검토 화면의 한 덩어리. 왼쪽 좁은 칸에 제목과 개수, 오른쪽에 내용이다 — 섹션을 훑는 눈이
 * 왼쪽 세로줄만 따라 내려가도 무엇이 몇 개인지 읽힌다. 좁은 화면에서는 위아래로 쌓인다.
 * [copy] 를 주면 제목 옆에 마크다운 복사가 선다. 제목 칸 아래(넓은 화면) · 오른쪽 끝(좁은 화면)이다.
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
    <section
      aria-label={title}
      className="grid grid-cols-1 gap-y-3 border-t border-[var(--el-hairline)] pt-6 pb-[26px] sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-x-7"
    >
      <div className="flex items-baseline gap-2 sm:flex-col sm:gap-1 sm:pt-1.5">
        <h3 className="text-[13px] font-semibold text-[var(--el-ink)]">{title}</h3>
        {count === undefined ? null : (
          <span className="font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
            {count}
          </span>
        )}
        {copy ? (
          <CopyMarkdownButton
            label={title}
            build={copy.build}
            disabled={copy.disabled}
            className="ml-auto h-7 self-center px-2 text-xs text-[var(--el-muted)] sm:mt-1 sm:-ml-2 sm:self-start"
          />
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
