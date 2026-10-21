"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useGetAnalysisFlow } from "@/lib/api/generated/analysis/analysis";
import type {
  MeetingAnalysisFlowResponseDataStatus,
  NoteResponseData,
} from "@/lib/api/generated/models";

/** 분석 흐름 상태를 사람이 읽는 한 문장으로. 내부 처리 순서(화자 나누기·담당·기한 보강)는 말하지 않는다. */
const ANALYSIS_COPY: Partial<
  Record<MeetingAnalysisFlowResponseDataStatus, string>
> = {
  DIARIZING: "분석 중입니다.",
  ANALYZING: "분석 중입니다.",
  REVIEWABLE: "검토할 결과가 준비되었습니다.",
  ANALYSIS_FAILED: "분석하지 못했습니다.",
};

/** 사람이 종료했거나 옛 노트(`autoEnd` 없음)는 아니다. */
export function isAutoEnded(note: NoteResponseData) {
  return note.meetingStatus === "ENDED" && note.autoEnd?.endedBy === "SYSTEM";
}

export function autoEndReason(note: NoteResponseData) {
  const days = note.autoEnd?.pausedBusinessDays;
  return days
    ? `마지막 중지 후 ${days}영업일이 지나 종료했습니다.`
    : "중지 상태가 오래 이어져 종료했습니다.";
}

/**
 * 자동 종료된 노트의 고정 안내(APP-1319, PRO-67 userflow 「자동 종료된 노트의 고정 안내」). 상단바 아래에 서서 탭을
 * 바꿔도 남는다. 알림을 끈 사람과 나중에 들어온 사람에게는 이것이 유일한 설명이다.
 *
 * 접으면 첫 문장만 남는다. 사유와 시각은 정보 탭 「회의 정보」에도 있어(시각은 거기만) 접어도 잃지 않는다.
 * 분석 상태는 분석 흐름 쿼리를 읽는다 — 요약·스크립트 탭이 같은 키를 갱신한다.
 */
export function NoteAutoEndNotice({ note }: { note: NoteResponseData }) {
  const [open, setOpen] = useState(true);
  const flow = useGetAnalysisFlow(note.noteId);
  const status =
    flow.data?.status === 200 && flow.data.data.success
      ? flow.data.data.data.status
      : null;
  const analysis = status ? ANALYSIS_COPY[status] : undefined;

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
            회의를 자동으로 종료했습니다.
          </span>
          {open ? (
            <>
              {` ${autoEndReason(note)} 이 회의에는 이어서 녹음할 수 없습니다.`}
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
          {open ? "접기" : "펼치기"}
        </Button>
      </div>
    </div>
  );
}
