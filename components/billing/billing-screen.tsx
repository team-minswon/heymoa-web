import type { ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * 결제 대행사에서 돌아오는 카드 등록 결과 화면의 틀(설정 창 밖이라 자기 틀이 있다). `AllTasks` 와 같은 폭·머리글 리듬이다.
 * 제목은 고정 문구라 조회를 기다리지 않고 그린다.
 */
export function BillingScreen({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <ScrollArea
      className="min-h-0 flex-1"
      viewportClassName="overflow-x-hidden!"
    >
      <div className="mx-auto w-full max-w-4xl px-5 pb-16 pt-8 sm:px-8 sm:pt-11">
        <header className="border-b border-[var(--el-hairline)] pb-6">
          <h2 className="text-screen-title font-light leading-[1.05] tracking-[-0.035em] text-[var(--el-ink)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-3 text-sm leading-6 text-[var(--el-muted)]">
              {description}
            </p>
          ) : null}
        </header>
        <div className="mt-8 flex flex-col gap-10">{children}</div>
      </div>
    </ScrollArea>
  );
}
