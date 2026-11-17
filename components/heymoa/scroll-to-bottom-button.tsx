"use client";

import { ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ScrollToBottomButton({
  label,
  onClick,
  className,
  visible = true,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  visible?: boolean;
}) {
  return (
    <div
      data-visible={visible || undefined}
      inert={!visible}
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center",
        "transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        className
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label={label}
        className={cn(
          "rounded-full bg-[var(--el-surface-card)]/95 shadow-e2 backdrop-blur-xl",
          visible && "pointer-events-auto"
        )}
        onClick={onClick}
      >
        <ArrowDown className="size-4" />
      </Button>
    </div>
  );
}
