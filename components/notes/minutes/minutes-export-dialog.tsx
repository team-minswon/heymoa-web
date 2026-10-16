"use client";

import { useId, useState } from "react";

import { downloadBlob, renderMinutesPdf } from "@/components/notes/minutes/render-minutes-pdf";
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
import type { MinutesDocument, MinutesInclude } from "@/lib/notes/minutes/model";
import { toast } from "@/lib/ui/toast";

/**
 * 회의록 PDF 내려받기. 회의록 본문은 늘 들어가고 붙임 녹취록만 고른다. **녹취록은 꺼 둔 채 연다** — 한 말이
 * 그대로 남는 기록이라, 보내는 사람이 직접 켰을 때만 싣는다.
 */
export function MinutesExportDialog({
  open,
  onOpenChange,
  build,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  build: (include: MinutesInclude) => Promise<MinutesDocument>;
}) {
  const id = useId();
  const [include, setInclude] = useState<MinutesInclude>({ transcript: false });
  const [pending, setPending] = useState(false);
  // **열 때마다 녹취록을 끈다.** 창은 닫혀도 마운트된 채라, 지난번에 켠 녹취록이 다음 내보내기에 말없이 실렸다.
  // 렌더 중에 연 순간을 보고 되돌린다 — effect 로 하면 켜진 채 한 번 그려진다
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setInclude({ transcript: false });
  }

  const download = async () => {
    setPending(true);
    try {
      const doc = await build(include);
      downloadBlob(await renderMinutesPdf(doc), doc.fileName);
      track("summary_exported", { target: "pdf", transcript: include.transcript });
      onOpenChange(false);
    } catch {
      // 다시 시도는 창의 「PDF 받기」로 한다 — 토스트에 다시 시도를 달면 실패한 그때의 녹취록 선택으로 다시 만들어,
      // 그 사이 끈 녹취록이 실렸다. 창은 열린 채라 지금 고른 대로 다시 받는다
      toast.error("회의록 PDF를 만들지 못했습니다.", {
        id: "export-minutes",
        description: "잠시 후 「PDF 받기」를 다시 눌러 주세요.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    // 만드는 동안에는 닫지 않는다 — 닫아도 내려받기는 계속돼, 닫은 창에서 파일이 튀어나온다
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>회의록 PDF로 내보내기</DialogTitle>
          <DialogDescription>회의록(핵심 요약 · 결정 · 할 일 · 미결 사항)은 늘 들어갑니다. 녹취록을 붙일지 고르세요.</DialogDescription>
        </DialogHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <label htmlFor={`${id}-transcript`} className="font-medium text-foreground">
              녹취록
            </label>
            <span id={`${id}-transcript-hint`} className="text-xs break-keep text-muted-foreground">
              회의에서 한 말을 그대로 붙입니다. 받는 사람이 모든 발언을 읽게 됩니다.
            </span>
          </div>
          <Switch
            id={`${id}-transcript`}
            aria-describedby={`${id}-transcript-hint`}
            checked={include.transcript}
            disabled={pending}
            onCheckedChange={(checked) => setInclude({ transcript: checked })}
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>취소</DialogClose>
          <Button loading={pending} onClick={() => void download()}>
            PDF 받기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
