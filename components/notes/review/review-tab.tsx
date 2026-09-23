"use client";

import {
  FlowNotice,
  isWaitingStatus,
} from "@/components/notes/review/flow-notice";
import {
  ReviewBoard,
  ReviewBoardSkeleton,
} from "@/components/notes/review/review-board";
import { NoteSummary } from "@/components/notes/note-summary";
import { InlineRetry } from "@/components/ui/inline-retry";
import { useGetAnalysisFlow } from "@/lib/api/generated/analysis/analysis";
import { okData } from "@/lib/api/ok-data";
import { flowPollInterval } from "@/lib/notes/review/flow-cache";
import type { NoteMeta } from "@/lib/notes/copy-markdown";
import type { SpeakerFace } from "@/lib/transcription/speaker-identity";

/**
 * 요약 탭. 흐름 상태 하나가 무엇을 그릴지 정한다 — 지난 노트는 구형 요약을 읽기만 하고,
 * 분석이 도는 동안은 진행을, 검토본이 서면 검토 화면을 그린다.
 */
export function ReviewTab({
  noteId,
  workspaceId,
  projectId,
  isEnded,
  noteMeta,
  participants,
  onEvidenceSelect,
  onOpenTranscript,
}: {
  noteId: string;
  workspaceId: string | undefined;
  projectId: string | undefined;
  isEnded: boolean;
  noteMeta?: NoteMeta | null;
  participants: SpeakerFace[];
  onEvidenceSelect: (segmentId: string) => void;
  onOpenTranscript: () => void;
}) {
  const flowQuery = useGetAnalysisFlow(noteId, {
    query: {
      enabled: isEnded,
      // 끝나는 시각을 모르는 단계만 다시 묻는다. 검토 가능 · 확정은 사람이 움직일 때 다시 읽는다.
      refetchInterval: (query) =>
        flowPollInterval(okData(query.state.data)?.status ?? null),
    },
  });

  if (!isEnded) {
    return (
      <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pt-6 pb-16">
        <div className="rounded-panel border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-5">
          <p className="text-sm font-medium text-[var(--el-ink)]">
            요약은 회의가 끝나면 정리됩니다
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--el-muted)]">
            회의를 끝내면 결정 · 할 일 · 이슈를 주제로 묶어 검토할 수 있게
            됩니다.
          </p>
        </div>
      </div>
    );
  }

  const flow = okData(flowQuery.data);

  if (flowQuery.isLoading) return <ReviewBoardSkeleton />;

  if (!flow) {
    return (
      <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pt-6">
        <InlineRetry
          variant="line"
          label="요약 상태를 불러오지 못했습니다."
          onRetry={() => void flowQuery.refetch()}
        />
      </div>
    );
  }

  if (flow.status === "NOT_APPLICABLE") {
    return (
      <NoteSummary
        noteId={noteId}
        isEnded={isEnded}
        noteMeta={noteMeta}
        onEvidenceSelect={onEvidenceSelect}
        readOnly
      />
    );
  }

  if (isWaitingStatus(flow.status)) {
    return (
      <FlowNotice
        noteId={noteId}
        status={flow.status}
        onOpenTranscript={onOpenTranscript}
      />
    );
  }

  return (
    <ReviewBoard
      // 노트나 흐름 상태가 바뀌면 보기 · 주제 · 펼친 줄 · 편집 잠금을 새로 시작한다.
      key={`${noteId}:${flow.status}`}
      noteId={noteId}
      workspaceId={workspaceId}
      projectId={projectId}
      confirmed={flow.status === "CONFIRMED"}
      canEdit={flow.status === "REVIEWABLE"}
      participants={participants}
      onOpenScript={onEvidenceSelect}
      onOpenTranscript={onOpenTranscript}
    />
  );
}
