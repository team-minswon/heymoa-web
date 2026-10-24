"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * 패널의 아이콘 버튼 크기. 두 단계만 쓴다 — 머리글은 34px, 그 밖(줄 메뉴·복사·@·아래로)은 32px. 손가락으로 누르는
 * 화면(`pointer: coarse`)에서는 둘 다 44px 이다. 아이콘은 머리글 18px, 그 밖 16px 이고 버튼 가운데에 선다.
 */
export const CHAT_ICON_BUTTON_SIZE = {
  header: "size-[34px] pointer-coarse:size-11 [&_svg]:size-[18px]",
  md: "size-8 pointer-coarse:size-11 [&_svg]:size-4",
} as const;

/** 크기를 뺀 생김새. 메뉴 트리거처럼 이 컴포넌트를 못 쓰는 자리도 이걸 붙인다. */
export const CHAT_ICON_BUTTON_LOOK =
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control text-[var(--el-body)] outline-none transition-colors duration-150 hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent aria-expanded:bg-[var(--el-surface-strong)] motion-reduce:transition-none [&_svg]:shrink-0";

/**
 * 「내 에이전트」 패널의 아이콘 버튼. 이름은 접근성 이름이자 데스크톱 툴팁이다 — 둘이 갈리면 화면 읽기와 눈이 다른 말을 듣는다.
 * 툴팁은 마우스·키보드 포커스에서만 뜬다(Base UI). 터치에서는 안 뜬다.
 */
export function ChatIconButton({
  label,
  size = "md",
  tooltipSide = "bottom",
  className,
  ref,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "aria-label"> & {
  label: string;
  size?: keyof typeof CHAT_ICON_BUTTON_SIZE;
  tooltipSide?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            ref={ref}
            type="button"
            aria-label={label}
            className={cn(
              CHAT_ICON_BUTTON_LOOK,
              CHAT_ICON_BUTTON_SIZE[size],
              className
            )}
            {...props}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}
