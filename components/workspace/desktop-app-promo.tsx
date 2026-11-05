"use client";

import { CircleHelp, Monitor } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { DesktopDownloadLink } from "@/components/heymoa/desktop-download-link";
import { DesktopCompareDialog } from "@/components/workspace/desktop-compare-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDesktopApp } from "@/lib/desktop/use-desktop-app";
import { cn } from "@/lib/utils";

export function DesktopAppPromo() {
  const t = useTranslations("shell.desktopPromo");
  const isDesktopApp = useDesktopApp();
  const [compareOpen, setCompareOpen] = useState(false);
  if (isDesktopApp !== false) return null;

  return (
    <aside
      aria-label={t("label")}
      className="mb-5 hidden min-h-[68px] items-center gap-3 rounded-control border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-3 md:flex"
    >
      <Monitor aria-hidden className="size-5 shrink-0 text-[var(--el-muted)]" />
      <p className="min-w-0 flex-1 text-sm leading-6 font-medium text-[var(--el-ink)]">
        {t("body")}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={t("compare")}
                onClick={() => setCompareOpen(true)}
                className="ml-1 inline-flex size-6 cursor-pointer items-center justify-center rounded-control align-middle text-[var(--el-muted)] transition-colors hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            }
          >
            <CircleHelp aria-hidden className="size-4" />
          </TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={8}
            className="whitespace-nowrap"
          >
            {t("compareTooltip")}
          </TooltipContent>
        </Tooltip>
      </p>
      <DesktopDownloadLink
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-10 shrink-0 rounded-chip border-[var(--el-hairline)] bg-white text-[var(--el-ink)] hover:bg-[var(--el-canvas-soft)]"
        )}
      />
      <DesktopCompareDialog open={compareOpen} onOpenChange={setCompareOpen} />
    </aside>
  );
}
