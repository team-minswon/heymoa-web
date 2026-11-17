"use client";

import { useState } from "react";
import { Copy, FileText, Mail, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MinutesExportDialog } from "@/components/notes/minutes/minutes-export-dialog";
import type { PrepareMinutesPdf } from "@/components/notes/minutes/render-minutes-pdf";
import { track } from "@/lib/analytics/track";
import { renderExport, type ExportFormat } from "@/lib/notes/review/markdown";
import type {
  MinutesDocument,
  MinutesInclude,
} from "@/lib/notes/minutes/model";
import { copyText } from "@/lib/ui/copy-text";
import { toast } from "@/lib/ui/toast";

const COPY_FORMATS: readonly ExportFormat[] = ["text", "markdown"];

const EXPORT_TARGETS = [
  { target: "pdf", icon: FileText },
  { target: "email", icon: Mail },
] as const;

export function ReviewActions({
  build,
  disabled,
  wider,
  material,
  onRetryMaterial,
  onSendEmail,
}: {
  build: () => string;
  disabled?: boolean;
  wider?: {
    minutes: (include: MinutesInclude) => Promise<MinutesDocument>;
    preparePdf?: PrepareMinutesPdf;
    version?: string;
  };
  material?: "loading" | "failed";
  onRetryMaterial?: () => void;
  onSendEmail?: () => void;
}) {
  const t = useTranslations("notes.share");
  const tAction = useTranslations("common.actions");
  const [minutesOpen, setMinutesOpen] = useState(false);

  const copy = async (format: ExportFormat) => {
    try {
      await copyText(renderExport(format, build()));
      track("summary_copied", { format, scope: "summary" });
      toast.success(t("copied"), {
        id: "copy-summary",
      });
    } catch {
      toast.error(t("copyFailed"), {
        id: "copy-summary",
        description: t("copyBlocked"),
        action: { label: tAction("retry"), onClick: () => void copy(format) },
      });
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3"
              disabled={disabled}
              aria-label={t("copyLabel")}
            />
          }
        >
          <Copy aria-hidden />
          <span className="hidden sm:inline">{t("copy")}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {COPY_FORMATS.map((format) => (
            <DropdownMenuItem
              key={format}
              className="flex-col items-start gap-0 py-1.5"
              onClick={() => void copy(format)}
            >
              <span className="font-medium">
                {t(`formats.${format}.label`)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t(`formats.${format}.hint`)}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3"
              aria-label={t("menuLabel")}
            />
          }
        >
          <Share2 aria-hidden />
          <span className="hidden sm:inline">{t("menu")}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-fit min-w-44">
          {EXPORT_TARGETS.filter(
            ({ target }) => target !== "email" || onSendEmail !== undefined
          ).map(({ target, icon: Icon }) => {
            const ready = wider !== undefined;
            const waiting = ready ? undefined : (material ?? "loading");
            return (
              <DropdownMenuItem
                key={target}
                disabled={(ready && disabled) || waiting === "loading"}
                onClick={() => {
                  track("export_requested", { target });
                  if (ready) {
                    if (target === "pdf") setMinutesOpen(true);
                    else onSendEmail?.();
                  } else if (waiting === "failed") {
                    onRetryMaterial?.();
                    toast.info(t("materialRetry"), {
                      id: "export-material",
                    });
                  }
                }}
              >
                <Icon aria-hidden />
                <span className="flex-1 whitespace-nowrap">
                  {t(`targets.${target}`)}
                </span>
                {waiting ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {waiting === "loading"
                      ? t("materialLoading")
                      : t("materialReload")}
                  </span>
                ) : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {wider ? (
        <MinutesExportDialog
          open={minutesOpen}
          onOpenChange={setMinutesOpen}
          build={wider.minutes}
          preparePdf={wider.preparePdf}
          version={wider.version}
        />
      ) : null}
    </div>
  );
}
