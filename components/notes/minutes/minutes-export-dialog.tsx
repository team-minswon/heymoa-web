"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import {
  downloadBlob,
  renderMinutesPdf,
} from "@/components/notes/minutes/render-minutes-pdf";
import type { PrepareMinutesPdf } from "@/components/notes/minutes/render-minutes-pdf";
import { PdfPreview } from "@/components/notes/minutes/pdf-preview";
import { usePdfArtifact } from "@/components/notes/minutes/use-pdf-artifact";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics/track";
import type {
  MinutesDocument,
  MinutesInclude,
} from "@/lib/notes/minutes/model";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";

export function MinutesExportDialog({
  open,
  onOpenChange,
  build,
  preparePdf,
  version = "initial",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  build: (include: MinutesInclude) => Promise<MinutesDocument>;
  preparePdf?: PrepareMinutesPdf;
  version?: string;
}) {
  const t = useTranslations("notes.minutes");
  const tAction = useTranslations("common.actions");
  const id = useId();
  const [include, setInclude] = useState<MinutesInclude>({ transcript: false });
  const [pending, setPending] = useState(false);
  const downloading = useRef(false);
  const [previewed, setPreviewed] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setInclude({ transcript: false });
      setPreviewed(false);
    }
  }
  const pdf = usePdfArtifact(
    open,
    version,
    include,
    preparePdf ??
      (async (option, signal) => {
        const doc = await build(option);
        signal?.throwIfAborted();
        return {
          blob: await renderMinutesPdf(doc, signal),
          fileName: doc.fileName,
        };
      })
  );
  const preview = async () => {
    try {
      await pdf.prepare();
      setPreviewed(true);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        toast.error(t("pdfFailed"));
    }
  };

  const download = async () => {
    if (downloading.current || pdf.pending) return;
    downloading.current = true;
    setPending(true);
    try {
      const result = await pdf.prepare();
      downloadBlob(result.blob, result.fileName);
      track("summary_exported", {
        target: "pdf",
        transcript: include.transcript,
      });
      onOpenChange(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(t("pdfFailed"), {
        id: "export-minutes",
        description: t("export.retryHint"),
      });
    } finally {
      downloading.current = false;
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}
    >
      <DialogContent
        className={`max-h-[calc(100dvh-2rem)] overflow-y-auto ${previewed ? "sm:max-w-4xl" : ""}`}
      >
        <DialogHeader>
          <DialogTitle>{t("export.title")}</DialogTitle>
          <DialogDescription>{t("export.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <label
              htmlFor={`${id}-transcript`}
              className="font-medium text-foreground"
            >
              {t("export.transcript")}
            </label>
            <span
              id={`${id}-transcript-hint`}
              className="text-xs text-muted-foreground"
            >
              {t("export.transcriptHint")}
            </span>
          </div>
          <Switch
            id={`${id}-transcript`}
            aria-describedby={`${id}-transcript-hint`}
            checked={include.transcript}
            disabled={pending || pdf.pending}
            onCheckedChange={(checked) => setInclude({ transcript: checked })}
          />
        </div>
        <div>
          <Button
            variant="outline"
            loading={pdf.pending && !pending}
            disabled={pending}
            onClick={() => void preview()}
          >
            {t("export.preview")}
          </Button>
          {previewed ? (
            <PdfPreview blob={pdf.artifact?.blob ?? null}>
              {pdf.invalidated ? <Invalidated /> : null}
            </PdfPreview>
          ) : pdf.invalidated ? (
            <Invalidated className="mt-2" />
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            {tAction("cancel")}
          </DialogClose>
          <Button
            loading={pending}
            disabled={pdf.pending}
            onClick={() => void download()}
          >
            {t("export.download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Invalidated({ className }: { className?: string }) {
  const t = useTranslations("notes.minutes");
  return (
    <p role="status" className={cn("text-sm text-muted-foreground", className)}>
      {t("invalidated")}
    </p>
  );
}
