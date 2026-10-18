"use client";

import { useQueryClient } from "@tanstack/react-query";

import {
  getGetMeetingReviewSummaryQueryKey,
  type getMeetingReviewSummaryResponse,
} from "@/lib/api/generated/meeting-review/meeting-review";
import {
  FlowNotice,
  isWaitingStatus,
} from "@/components/notes/review/flow-notice";
import {
  ReviewBoard,
  ReviewBoardSkeleton,
} from "@/components/notes/review/review-board";
import { NoteSummary } from "@/components/notes/note-summary";
import { PreEndGuide } from "@/components/notes/pre-end-guide";
import type { NoteResponseData } from "@/lib/api/generated/models";
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
  currentUserId,
  currentUserName,
  dockRaised = false,
  onEvidenceSelect,
  onOpenTranscript,
  onOpenTimeline,
  note,
  onEditParticipants,
  onMeetingEnded,
}: {
  noteId: string;
  workspaceId: string | undefined;
  projectId: string | undefined;
  isEnded: boolean;
  noteMeta?: NoteMeta | null;
  participants: (SpeakerFace & { email?: string | null })[];
  currentUserId?: string | null;
  currentUserName?: string | null;
  /** 「이 회의에 대해 물어보기」 알약이 아래 가운데에 떠 있다 */
  dockRaised?: boolean;
  onEvidenceSelect: (segmentId: string) => void;
  onOpenTranscript: () => void;
  onOpenTimeline?: () => void;
  /** 종료 전 안내가 종료 확인창을 직접 연다. */
  note?: NoteResponseData | null;
  onEditParticipants?: () => void;
  onMeetingEnded?: () => void;
}) {
  const queryClient = useQueryClient();
  const flowQuery = useGetAnalysisFlow(noteId, {
    query: {
      enabled: isEnded,
      staleTime: 0,
      refetchOnMount: "always",
      // 끝나는 시각을 모르는 단계만 다시 묻는다. 검토 가능 · 확정은 사람이 움직일 때 다시 읽는다.
      refetchInterval: (query) =>
        flowPollInterval(
          okData(query.state.data)?.status ?? null,
          okData(query.state.data)?.regions
        ),
    },
  });

  if (!isEnded) {
    return (
      <PreEndGuide
        note={note}
        onEditParticipants={onEditParticipants}
        onMeetingEnded={onMeetingEnded}
      />
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

  const hasSummary =
    okData(
      queryClient.getQueryData<getMeetingReviewSummaryResponse>(
        getGetMeetingReviewSummaryQueryKey(noteId)
      )
    )?.status === "SUCCEEDED";
  if (
    isWaitingStatus(flow.status) &&
    !hasSummary &&
    !flow.regions?.some(
      (row) => row.region === "SUMMARY" && row.status === "SUCCEEDED"
    )
  ) {
    return (
      <FlowNotice
        noteId={noteId}
        status={flow.status}
        verified={flowQuery.isFetchedAfterMount && !flowQuery.isError}
        onOpenTranscript={onOpenTranscript}
      />
    );
  }

  return (
    <>
      {isWaitingStatus(flow.status) ? (
        <FlowNotice
          compact
          noteId={noteId}
          status={flow.status}
          verified={flowQuery.isFetchedAfterMount && !flowQuery.isError}
          onOpenTranscript={onOpenTranscript}
        />
      ) : null}
      <ReviewBoard
        // 뒤늦은 관계·담당 도착이나 재분석으로 열어 둔 줄과 편집 초안을 초기화하지 않는다.
        key={noteId}
        noteId={noteId}
        flow={flow}
        workspaceId={workspaceId}
        projectId={projectId}
        confirmed={flow.status === "CONFIRMED"}
        canEdit={flow.status === "REVIEWABLE"}
        noteMeta={noteMeta}
        participants={participants}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        dockRaised={dockRaised}
        onOpenScript={onEvidenceSelect}
        onOpenTranscript={onOpenTranscript}
        onOpenTimeline={onOpenTimeline}
      />
    </>
  );
}
