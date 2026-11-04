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

/**
 * 회의록 PDF 내려받기. 회의록 본문은 늘 들어가고 붙임 녹취록만 고른다. **녹취록은 꺼 둔 채 연다** — 한 말이
 * 그대로 남는 기록이라, 보내는 사람이 직접 켰을 때만 싣는다.
 */
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
  // **열 때마다 녹취록을 끈다.** 창은 닫혀도 마운트된 채라, 지난번에 켠 녹취록이 다음 내보내기에 말없이 실렸다.
  // 렌더 중에 연 순간을 보고 되돌린다 — effect 로 하면 켜진 채 한 번 그려진다
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
      // 다시 시도는 창의 「PDF 받기」로 한다 — 토스트에 다시 시도를 달면 실패한 그때의 녹취록 선택으로 다시 만들어,
      // 그 사이 끈 녹취록이 실렸다. 창은 열린 채라 지금 고른 대로 다시 받는다
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
    // 만드는 동안에는 닫지 않는다 — 닫아도 내려받기는 계속돼, 닫은 창에서 파일이 튀어나온다
    <Dialog
      open={open}
      onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}
    >
      <DialogContent
        // 넓히는 기준은 「미리보기를 열었나」다(APP-1356). PDF 가 있는지로 가르면 녹취록을 켜고 끌 때마다 PDF 가 무효가 되어
        // 창이 896 → 384px 로 접혔다가 다시 미리보면 또 펴졌다. 미리보기가 A4 를 보여 줘야 해서 여는 순간 넓어지는 것은 그대로다
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
