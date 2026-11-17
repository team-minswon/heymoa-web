"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useGetAnalysisFlow } from "@/lib/api/generated/analysis/analysis";
import type {
  MeetingAnalysisFlowResponseDataStatus,
  NoteResponseData,
} from "@/lib/api/generated/models";

const ANALYSIS_KEY: Partial<
  Record<
    MeetingAnalysisFlowResponseDataStatus,
    "analyzing" | "reviewable" | "failed"
  >
> = {
  DIARIZING: "analyzing",
  ANALYZING: "analyzing",
  REVIEWABLE: "reviewable",
  ANALYSIS_FAILED: "failed",
};

export function isAutoEnded(note: NoteResponseData) {
  return note.meetingStatus === "ENDED" && note.autoEnd?.endedBy === "SYSTEM";
}

export function NoteAutoEndNotice({ note }: { note: NoteResponseData }) {
  const t = useTranslations("notes.autoEnd");
  const [open, setOpen] = useState(true);
  const flow = useGetAnalysisFlow(note.noteId);
  const status =
    flow.data?.status === 200 && flow.data.data.success
      ? flow.data.data.data.status
      : null;
  const analysisKey = status ? ANALYSIS_KEY[status] : undefined;
  const analysis = analysisKey ? t(`analysis.${analysisKey}`) : undefined;
  const days = note.autoEnd?.pausedBusinessDays;
  const reason = days ? t("reasonDays", { days }) : t("reason");

  return (
    <div
      role="status"
      data-testid="note-status-band"
      className="shrink-0 border-b border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-[var(--note-gutter)] py-2.5"
    >
      <div className="mx-auto flex w-full max-w-[820px] items-start gap-2 text-[13px] leading-5 text-[var(--el-body)]">
        <Info
          aria-hidden
          className="mt-[3px] size-3.5 shrink-0 text-[var(--el-muted)]"
        />
        <p className="min-w-0 flex-1 text-pretty">
          <span className="font-medium text-[var(--el-ink)]">
            {t("title")}
          </span>
          {open ? (
            <>
              {` ${reason} ${t("noResume")}`}
              {analysis ? (
                <>
                  {" "}
                  <span className="whitespace-nowrap">{analysis}</span>
                </>
              ) : null}
            </>
          ) : null}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="-my-0.5 shrink-0 text-[var(--el-muted)]"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? t("collapse") : t("expand")}
        </Button>
      </div>
    </div>
  );
}
