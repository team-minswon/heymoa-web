"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const CHAT_ICON_BUTTON_SIZE = {
  header: "size-[34px] pointer-coarse:size-11 [&_svg]:size-[18px]",
  md: "size-8 pointer-coarse:size-11 [&_svg]:size-4",
} as const;

export const CHAT_ICON_BUTTON_LOOK =
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control text-[var(--el-body)] outline-none transition-colors duration-150 hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent aria-expanded:bg-[var(--el-surface-strong)] motion-reduce:transition-none [&_svg]:shrink-0";

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
