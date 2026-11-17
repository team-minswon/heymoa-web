"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { HelpBadgeName } from "@/app/[lang]/help/_content/types";
import { cn } from "@/lib/utils";

export function HelpBadge({
  name,
  className,
}: {
  name: HelpBadgeName;
  className?: string;
}) {
  const t = useTranslations("help.badge");
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-[18px] shrink-0 rounded-full bg-[var(--el-surface-strong)] px-2 text-[11px] leading-none font-normal text-[var(--tv-body)] group-aria-[current=page]/item:bg-white",
        className
      )}
    >
      <span aria-hidden>{t(name)}</span>
      <span className="sr-only">{t(`${name}Spoken`)}</span>
    </Badge>
  );
}
