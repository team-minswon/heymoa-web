"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

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
import { useReadAnalysisReadyOnView } from "@/components/notification/use-read-analysis-ready";
import { useRefetchOnReveal } from "@/components/notes/review/use-refetch-on-reveal";
import {
  getGetAnalysisFlowQueryKey,
  useGetAnalysisFlow,
} from "@/lib/api/generated/analysis/analysis";
import { okData } from "@/lib/api/ok-data";
import { flowPollInterval } from "@/lib/notes/review/flow-cache";
import { useEventStreamHealthy } from "@/lib/events/health";
import { hintedInterval } from "@/lib/events/interval";
import type { NoteMeta } from "@/lib/notes/copy-markdown";
import type { SpeakerFace } from "@/lib/transcription/speaker-identity";

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
  active = true,
}: {
  noteId: string;
  active?: boolean;
  workspaceId: string | undefined;
  projectId: string | undefined;
  isEnded: boolean;
  noteMeta?: NoteMeta | null;
  participants: (SpeakerFace & { email?: string | null })[];
  currentUserId?: string | null;
  currentUserName?: string | null;
  dockRaised?: boolean;
  onEvidenceSelect: (segmentId: string) => void;
  onOpenTranscript: () => void;
  onOpenTimeline?: (agendaId: string | null) => void;
  note?: NoteResponseData | null;
  onEditParticipants?: () => void;
  onMeetingEnded?: () => void;
}) {
  const t = useTranslations("notes.review");
  const queryClient = useQueryClient();
  const streamHealthy = useEventStreamHealthy();
  const flowQuery = useGetAnalysisFlow(noteId, {
    query: {
      enabled: isEnded,
      staleTime: 0,
      refetchOnMount: "always",
      refetchInterval: (query) =>
        active &&
        hintedInterval(
          streamHealthy,
          flowPollInterval(
            okData(query.state.data)?.status ?? null,
            okData(query.state.data)?.regions
          )
        ),
    },
  });

  useRefetchOnReveal(active, [getGetAnalysisFlowQueryKey(noteId)]);
  const shownStatus = okData(flowQuery.data)?.status;
  useReadAnalysisReadyOnView(
    noteId,
    active &&
      isEnded &&
      !flowQuery.isError &&
      (shownStatus === "REVIEWABLE" || shownStatus === "CONFIRMED")
  );

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

  const retryFlow = (
    <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pt-6">
      <InlineRetry
        variant="line"
        label={t("statusFailed")}
        onRetry={() => void flowQuery.refetch()}
      />
    </div>
  );
  if (!flow) return retryFlow;

  if (flow.status === "NOT_APPLICABLE") {
    return (
      <NoteSummary
        noteId={noteId}
        workspaceId={workspaceId}
        isEnded={isEnded}
        noteMeta={noteMeta}
        onEvidenceSelect={onEvidenceSelect}
        readOnly
        active={active}
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
    if (flowQuery.isError) return retryFlow;
    return (
      <FlowNotice
        noteId={noteId}
        status={flow.status}
        retryable={flow.retryable}
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
          retryable={flow.retryable}
          verified={flowQuery.isFetchedAfterMount && !flowQuery.isError}
          onOpenTranscript={onOpenTranscript}
        />
      ) : null}
      <ReviewBoard
        key={noteId}
        noteId={noteId}
        flow={flow}
        flowUpdatedAt={flowQuery.dataUpdatedAt}
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
        active={active}
      />
    </>
  );
}
