"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export function ShowMoreButton({
  open,
  moreLabel,
  subject,
  onToggle,
  className,
}: {
  open: boolean;
  moreLabel: string;
  subject?: string;
  onToggle: () => void;
  className?: string;
}) {
  const t = useTranslations("common.actions");
  const text = open ? t("collapse") : moreLabel;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={subject ? `${subject} ${text}` : undefined}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1 text-[12.5px] text-[var(--el-muted)] hover:text-[var(--el-ink)]",
        className
      )}
    >
      <ChevronDown
        aria-hidden
        className={cn(
          "size-[13px] transition-transform duration-200 ease-out motion-reduce:transition-none",
          open && "rotate-180"
        )}
      />
      {text}
    </button>
  );
}
