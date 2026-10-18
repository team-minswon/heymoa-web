"use client";

import { useId, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * 제목 옆 ? 도움말 (PRO-61 「도움말 ? 규칙」). 읽지 않아도 쓸 수 있는 부가 설명만 담는다 — 남은 개수·오류·상태 안내처럼
 * 없으면 못 쓰는 정보는 본문에 둔다.
 *
 * - 제목 글자와 같은 줄 가운데에 앉는다. 아이콘 16px, 누르는 자리 24px. 바깥 여백을 음수로 줘 24px 이 제목 줄 높이를
 *   늘리지 않는다.
 * - 말풍선은 아래쪽, 아이콘 왼쪽 끝에 맞춰 펼치고 화살표가 아이콘을 가리킨다. 가장자리에서는 위치 계산이 방향을 바꾼다.
 * - hover · 키보드 포커스 · 누르기로 연다. 터치에는 hover 가 없어 누르기가 유일한 입구다 — 기본 툴팁은 누르면 닫히므로
 *   `closeOnClick` 을 끄고 누르면 연다. Esc · 바깥 누르기는 툴팁이 닫는다.
 * - 스크린리더는 「도움말: 제목」을 읽고, 설명을 `aria-describedby` 로 함께 읽는다(말풍선은 열릴 때만 DOM 에 있다).
 */
export function HelpTip({
  label,
  children,
  className,
}: {
  /** 무엇의 도움말인가. 「도움말: {label}」로 읽힌다. */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        closeOnClick={false}
        delay={150}
        onClick={() => setOpen(true)}
        aria-label={`도움말: ${label}`}
        aria-describedby={descriptionId}
        render={<button type="button" />}
        className={cn(
          "-my-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--el-muted)] outline-none transition-colors hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:text-[var(--el-ink)]",
          className
        )}
      >
        <CircleHelp className="size-4" aria-hidden />
        <span id={descriptionId} className="sr-only">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="block w-max max-w-[min(300px,calc(100vw-2rem))] px-3 py-2 text-left text-xs leading-relaxed break-keep font-normal tracking-normal"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
