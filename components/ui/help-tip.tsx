"use client";

import { useId, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function HelpTip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        closeOnClick={false}
        delay={150}
        onClick={() => setOpen(true)}
        aria-label={t("helpTip", { label })}
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
        className="block w-max max-w-[min(300px,calc(100vw-2rem))] px-3 py-2 text-left text-xs leading-relaxed font-normal tracking-normal"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
