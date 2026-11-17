"use client";

import { track } from "@/lib/analytics/track";
import { useSummaryViewed } from "@/lib/analytics/use-summary-viewed";

import { useDocLanguage } from "@/lib/i18n/use-doc-language";
import { reviewToMarkdown } from "@/lib/notes/review/markdown";
import { createMinutesPdfRenderer } from "@/components/notes/minutes/render-minutes-pdf";
import type { PrepareMinutesPdf } from "@/components/notes/minutes/render-minutes-pdf";
import { widerExports } from "@/lib/notes/minutes/exports";
import { overviewText, summaryTopics } from "@/lib/notes/review/summary";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SegmentedControl } from "@/components/heymoa/segmented-control";
import { ConfirmBar } from "@/components/notes/review/confirm-bar";
import { EvidenceQuotes } from "@/components/notes/review/evidence-quotes";
import { ItemDetail } from "@/components/notes/review/item-detail";
import { ItemTrail } from "@/components/notes/review/item-trail";
import { MeetingMap } from "@/components/notes/review/meeting-map";
import { PendingAnalysisRetry } from "@/components/notes/review/pending-analysis-retry";
import { ReviewGraph } from "@/components/notes/review/review-graph";
import { ReviewActions } from "@/components/notes/review/review-actions";
import { ShareMailDialog } from "@/components/notes/review/share-mail-dialog";
import { ReviewHead } from "@/components/notes/review/review-head";
import { ReviewOverview } from "@/components/notes/review/review-overview";
import { ReviewSection } from "@/components/notes/review/review-section";
import { SavedChoices } from "@/components/notes/review/saved-choices";
import { TopicIndex } from "@/components/notes/review/topic-index";
import { useRefetchOnReveal } from "@/components/notes/review/use-refetch-on-reveal";
import { RoleDot, roleOfItem } from "@/components/notes/review/role-dot";
import { SectionBlock } from "@/components/notes/review/section-block";
import {
  RelationContext,
  RelationSuggestion,
  ReplacementSuggestion,
  TaskChangeSuggestion,
} from "@/components/notes/review/suggestion-row";
import { SpeakerNudgeBanner } from "@/components/notes/speaker-nudge-banner";
import { useSpeakerFallbackNames } from "@/components/notes/speaker-chip";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { okData } from "@/lib/api/ok-data";
import {
  indexMeetingLinks,
  relationMatchesTarget,
  type MeetingRelation,
} from "@/lib/notes/review/meeting-links";
import type { MeetingAnalysisFlowResponseData } from "@/lib/api/generated/models";
import { getGetAnalysisFlowQueryKey } from "@/lib/api/generated/analysis/analysis";
import { useApproveMeetingReview } from "@/lib/api/generated/meeting-approval/meeting-approval";
import {
  getGetMeetingReviewQueryKey,
  getGetMeetingReviewSummaryQueryKey,
  useGetMeetingReview,
  useGetMeetingReviewSummary,
} from "@/lib/api/generated/meeting-review/meeting-review";
import {
  getGetProjectMeetingLinksQueryKey,
  getGetProjectTasksQueryKey,
  useGetProjectMeetingLinks,
  useGetProjectTasks,
} from "@/lib/api/generated/projects/projects";
import {
  getGetNoteTranscriptQueryKey,
  useGetNoteTranscript,
} from "@/lib/api/generated/transcription/transcription";
import type { AssigneeChoice } from "@/lib/assignees/describe";
import { useAssigneeChoices } from "@/lib/assignees/use-assignee-choices";
import type { NoteMeta } from "@/lib/notes/copy-markdown";
import {
  choiceOf,
  confirmBlockReason,
  confirmSummaryOf,
  unchosenSuggestionCount,
  taskApplyConflictsOf,
} from "@/lib/notes/review/confirm";
import { isProjectIncluded } from "@/lib/notes/review/project-approval";
import { moveFlowStatus } from "@/lib/notes/review/flow-cache";
import {
  hasMissingApply,
  missingChoicesOf,
} from "@/lib/notes/review/saved-choices";
import { meetingLengthOf } from "@/lib/notes/meeting-state";
import {
  citedSpanOf,
  quotesOf,
  segmentsById,
} from "@/lib/notes/review/moments";
import { isProjectTaskQueryKey } from "@/lib/tasks/task-groups";
import {
  REVIEW_SECTIONS,
  isSummaryKind,
  isSummarySection,
  sectionsOf,
  type ReviewItem,
} from "@/lib/notes/review/sections";
import { topicDigests, topicIndex } from "@/lib/notes/review/topics";
import { useReviewEditor } from "@/lib/notes/review/use-review-editor";
import {
  createSpeakerIdentityResolver,
  type SpeakerFace,
} from "@/lib/transcription/speaker-identity";
import { toast } from "@/lib/ui/toast";

type View = "summary" | "graph";

const VIEWS = ["summary", "graph"] as const;

const TSID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const COLLAPSE_SETTLE_MS = 240;

/** 확정 요청 식별자. 서버가 TSID 로 검증하므로 13자이고 첫 글자는 0~7 이다. 같은 본문을 다시 보낼 때만 같은 값을 쓴다. */
function newRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(13));
  return Array.from(
    bytes,
    (byte, index) => TSID_ALPHABET[index === 0 ? byte % 8 : byte % 32]
  ).join("");
}

const unfiledOpen = (
  items: readonly ReviewItem[],
  topicOf: (itemId: string) => number | null
) =>
  items.filter(
    (item) =>
      item.included &&
      (item.kind === "QUESTION" || item.kind === "ISSUE") &&
      topicOf(item.itemId) === null
  );

export function ReviewBoard({
  noteId,
  flow,
  flowUpdatedAt = 0,
  workspaceId,
  projectId,
  confirmed,
  canEdit,
  noteMeta,
  participants,
  currentUserId,
  currentUserName,
  dockRaised = false,
  onOpenScript,
  onOpenTranscript,
  onOpenTimeline,
  active = true,
}: {
  noteId: string;
  active?: boolean;
  flow?: MeetingAnalysisFlowResponseData;
  flowUpdatedAt?: number;
  workspaceId: string | undefined;
  projectId: string | undefined;
  confirmed: boolean;
  canEdit: boolean;
  noteMeta?: NoteMeta | null;
  participants: (SpeakerFace & { email?: string | null })[];
  currentUserId?: string | null;
  currentUserName?: string | null;
  dockRaised?: boolean;
  onOpenScript: (segmentId: string) => void;
  onOpenTranscript: () => void;
  onOpenTimeline?: (agendaId: string | null) => void;
}) {
  const t = useTranslations("notes.review.board");
  const tBlocked = useTranslations("notes.review.blocked");
  const tKind = useTranslations("notes.kinds");
  const tAction = useTranslations("common.actions");
  const fallbackNames = useSpeakerFallbackNames();
  const doc = useDocLanguage();
  const queryClient = useQueryClient();
  const editor = useReviewEditor(noteId);
  const reviewQuery = useGetMeetingReview(noteId, {
    query: {
      enabled: editor.busyItemId === null,
      staleTime: 0,
      refetchOnMount: "always",
    },
  });
  const summaryQuery = useGetMeetingReviewSummary(noteId, {
    query: { staleTime: 0, refetchOnMount: "always" },
  });
  const transcriptQuery = useGetNoteTranscript(noteId);
  const linksQuery = useGetProjectMeetingLinks(
    projectId ?? "",
    { noteId },
    {
      query: {
        enabled: Boolean(projectId),
        staleTime: 0,
        refetchOnMount: "always",
      },
    }
  );
  const linksData = okData(linksQuery.data);
  useRefetchOnReveal(active, [
    getGetMeetingReviewQueryKey(noteId),
    getGetMeetingReviewSummaryQueryKey(noteId),
    ...(projectId ? [getGetProjectMeetingLinksQueryKey(projectId)] : []),
    ...(workspaceId && projectId
      ? [getGetProjectTasksQueryKey(workspaceId, projectId)]
      : []),
  ]);
  const tasksQuery = useGetProjectTasks(workspaceId ?? "", projectId ?? "", {
    query: {
      enabled: Boolean(workspaceId && projectId),
      staleTime: 0,
      refetchOnMount: "always",
    },
  });
  const approve = useApproveMeetingReview({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [approveError, setApproveError] = useState<{
    version: number;
    message: string;
  } | null>(null);
  const regionStatus = (region: string) =>
    flow?.regions?.find((row) => row.region === region)?.status;
  const relationsStatus = regionStatus("RELATIONS");
  const enrichmentStatus = regionStatus("ITEM_ENRICHMENT");
  const flowSignature = `${flow?.status}:${(flow?.regions ?? []).map((row) => `${row.region}:${row.status}`).join(",")}`;
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const refreshKey = useMemo(
    () => ({ flowSignature, refreshAttempt }),
    [flowSignature, refreshAttempt]
  );
  const { refreshFailed, refreshingAnalysis } = useAnalysisRefresh({
    refreshKey,
    paused: editor.busyItemId !== null,
    noteId,
    projectId,
    workspaceId,
  });

  const [view, setView] = useState<View>("summary");
  const [mailOpen, setMailOpen] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const lastRequest = useRef<{ body: string; id: string } | null>(null);

  const review = okData(reviewQuery.data);
  const summary = okData(summaryQuery.data);
  useSummaryViewed(
    noteId,
    workspaceId,
    active && Boolean(review) && summary?.status === "SUCCEEDED"
  );
  const transcript = okData(transcriptQuery.data);
  const tasks = okData(tasksQuery.data)?.tasks ?? null;

  const items = useMemo(() => review?.items ?? [], [review]);
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.itemId, item])),
    [items]
  );
  const meetingLinks = useMemo(
    () => indexMeetingLinks(linksData, noteId, items),
    [linksData, noteId, items]
  );
  const topics = useMemo(() => topicIndex(summary), [summary]);
  const topicOf = (itemId: string) => topics.get(itemId) ?? null;
  const topicTitleOf = (ordinal: number) =>
    summaryTopics(summary).find((row) => row.ordinal === ordinal)?.title ?? "";
  const sections = sectionsOf(items, topicOf).filter((section) =>
    isSummarySection(section.key)
  );
  const tasksById = useMemo(
    () => new Map((tasks ?? []).map((task) => [task.taskId, task])),
    [tasks]
  );
  const segments = useMemo(() => transcript?.segments ?? [], [transcript]);
  const speakers = transcript?.diarization.speakers;
  const [renderPdf] = useState(createMinutesPdfRenderer);
  const exportVersion = useMemo(
    () =>
      JSON.stringify({
        noteId,
        noteMeta,
        confirmed,
        summary,
        items,
        transcript,
        participants,
        currentUserName,
        flowSignature,
        refreshAttempt,
      }),
    [
      noteId,
      noteMeta,
      confirmed,
      summary,
      items,
      transcript,
      participants,
      currentUserName,
      flowSignature,
      refreshAttempt,
    ]
  );
  const byId = useMemo(() => segmentsById(segments), [segments]);
  const spanOf = useCallback(
    (item: ReviewItem) => citedSpanOf(item, byId),
    [byId]
  );
  const citedAt = useCallback(
    (item: ReviewItem) => spanOf(item)?.startMs ?? null,
    [spanOf]
  );
  const digests = useMemo(
    () => topicDigests(summary, itemsById, spanOf),
    [summary, itemsById, spanOf]
  );

  const unnamedSpeakers = useMemo<AssigneeChoice[]>(
    () =>
      (speakers ?? [])
        .filter((speaker) => !speaker.assignedParticipantId)
        .map((speaker) => ({
          type: "SPEAKER_LABEL",
          noteId,
          label: speaker.label,
        })),
    [speakers, noteId]
  );
  const {
    choices: assigneeChoices,
    failed: assigneeFailed,
    retry: retryAssignees,
  } = useAssigneeChoices(workspaceId, unnamedSpeakers);
  const resolveSpeaker = useMemo(
    () =>
      createSpeakerIdentityResolver(
        speakers ?? [],
        participants,
        fallbackNames.speaker
      ),
    [speakers, participants, fallbackNames]
  );

  if (reviewQuery.isLoading) return <ReviewBoardSkeleton />;
  if (!review) {
    return (
      <BoardShell>
        <InlineRetry
          variant="line"
          label={t("loadFailed")}
          onRetry={() => void reviewQuery.refetch()}
          className="pt-6"
        />
      </BoardShell>
    );
  }

  const confirmSummary = confirmSummaryOf(items);
  const firstMissingApply = items.find(hasMissingApply);
  const taskConflicts = taskApplyConflictsOf(
    items,
    (id) => tasksById.get(id)?.revision
  );
  const taskStateOf = (
    change: ReviewItem["taskChanges"][number]
  ): "pending" | "ready" | "failed" => {
    const revision = tasksById.get(change.target.itemId)?.revision;
    const behind =
      revision !== undefined &&
      revision < (change.draft?.expectedRevision ?? change.target.revision);
    if (
      tasksQuery.isPending ||
      (behind && (tasksQuery.isFetching || tasksQuery.isPaused))
    )
      return "pending";
    return !tasks || (behind && tasksQuery.isError) ? "failed" : "ready";
  };
  const gateItems = items.map((item) =>
    isSummaryKind(item.kind)
      ? item
      : {
          ...item,
          replacements: [],
          taskChanges: [],
        }
  );
  const unnamedAssigned = items.filter(
    (item) =>
      item.included &&
      item.kind === "ACTION_ITEM" &&
      item.assignee?.type === "SPEAKER_LABEL"
  ).length;
  const editable = canEdit && !confirmed && !approve.isPending;

  const choose = (
    item: ReviewItem,
    targetId: string,
    decision: "END" | "KEEP"
  ) => editor.updateItem(item.itemId, { decisions: [{ targetId, decision }] });
  const saving = editor.busyItemId !== null;
  const hasTask = (taskId: string) => tasksById.has(taskId);
  const unchosen = unchosenSuggestionCount(gateItems, hasTask);
  const blockInput = {
    saving,
    duplicateApplies: taskConflicts.duplicates.size,
    staleApplies: taskConflicts.stale.size,
    hasTaskChanges: gateItems.some(
      (item) => isProjectIncluded(item) && item.taskChanges.length > 0
    ),
    tasks:
      !workspaceId ||
      !projectId ||
      tasksQuery.isPending ||
      gateItems.some(
        (item) =>
          isProjectIncluded(item) &&
          item.taskChanges.some((change) => taskStateOf(change) === "pending")
      )
        ? ("pending" as const)
        : tasks &&
            !gateItems.some(
              (item) =>
                isProjectIncluded(item) &&
                item.taskChanges.some(
                  (change) => taskStateOf(change) === "failed"
                )
            )
          ? ("ready" as const)
          : ("failed" as const),
  };
  const analysisBlock = reviewQuery.isError
    ? ("reviewStale" as const)
    : refreshFailed
      ? ("analysisStale" as const)
      : refreshingAnalysis
        ? ("analysisRefreshing" as const)
        : relationsStatus === "PENDING"
          ? ("relationsPending" as const)
          : enrichmentStatus === "PENDING"
            ? ("enrichmentPending" as const)
            : null;
  const missingChoiceBlock = firstMissingApply
    ? ("missingChoice" as const)
    : null;
  const choiceBlock = saving ? ("saving" as const) : missingChoiceBlock;
  const earlierBlock =
    analysisBlock ??
    choiceBlock ??
    confirmBlockReason({ ...blockInput, unchosen: 0 });
  const confirmBlock =
    analysisBlock ??
    choiceBlock ??
    confirmBlockReason({ ...blockInput, unchosen });
  const confirmBlocked = confirmBlock
    ? tBlocked(confirmBlock, { count: unchosen })
    : null;
  const firstUnchosen = sections
    .flatMap((section) => section.items)
    .find((item) => unchosenSuggestionCount([item], hasTask) > 0);

  const toggleItem = (itemId: string) =>
    setOpenItemId((current) => (current === itemId ? null : itemId));

  const scrollToItem = (itemId: string, focusChoice = false) => {
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    window.setTimeout(
      () => {
        const target = document.querySelector(
          `[data-item-scroll-target][data-item-id="${CSS.escape(itemId)}"]`
        );
        target?.scrollIntoView?.({
          block: "center",
          behavior: reduce ? "auto" : "smooth",
        });
        if (focusChoice)
          target
            ?.querySelector<HTMLButtonElement>("[data-clear-saved-choice]")
            ?.focus({ preventScroll: true });
      },
      reduce ? 0 : COLLAPSE_SETTLE_MS
    );
  };
  const showItem = (itemId: string, focusChoice = false) => {
    const target = itemsById.get(itemId);
    if (target && !isSummaryKind(target.kind)) setView("graph");
    setOpenItemId(itemId);
    scrollToItem(itemId, focusChoice);
  };

  const relationsOf = (item: ReviewItem) =>
    meetingLinks.byItemId.get(item.itemId) ?? [];
  const contextFor = (
    item: ReviewItem,
    target:
      | ReviewItem["replacements"][number]["target"]
      | ReviewItem["taskChanges"][number]["target"],
    kind?: string,
    fallbackReason?: string
  ) => {
    const relations = relationsOf(item).filter(
      (relation) =>
        (!kind || relation.kind === kind) &&
        relationMatchesTarget(relation, target)
    );
    return relations.length > 0
      ? relations.map((relation) => (
          <RelationContext
            key={relation.key}
            relation={relation}
            segments={segments}
            onOpenScript={onOpenScript}
            fallbackReason={fallbackReason}
            showKind={!kind}
            showSource={false}
          />
        ))
      : undefined;
  };
  const cardedRelation = (item: ReviewItem, relation: MeetingRelation) =>
    item.replacements.some(
      (replacement) =>
        replacement.kind === relation.kind &&
        relationMatchesTarget(relation, replacement.target)
    ) ||
    item.taskChanges.some((change) =>
      relationMatchesTarget(relation, change.target)
    );

  const suggestionsOf = (item: ReviewItem) =>
    item.replacements.length +
      item.taskChanges.length +
      missingChoicesOf(item).length +
      relationsOf(item).length >
    0 ? (
      <div className="space-y-1.5">
        <SavedChoices
          item={item}
          disabled={!editable || saving}
          onClear={(targetId) =>
            editor.updateItem(item.itemId, {
              decisions: [{ targetId, decision: null }],
            })
          }
        />
        {view === "graph" && editor.conflictItemId === item.itemId ? (
          <p role="alert" className="text-xs text-[var(--el-muted)]">
            {editor.conflictMessage}
          </p>
        ) : null}
        {(isProjectIncluded(item) ? item.replacements : []).map(
          (replacement) => (
            <ReplacementSuggestion
              key={replacement.target.itemId}
              replacement={replacement}
              newContent={item.content}
              context={contextFor(
                item,
                replacement.target,
                replacement.kind,
                replacement.reason
              )}
              choice={choiceOf(replacement.decision)}
              disabled={!editable || !isProjectIncluded(item) || saving}
              onChoose={(next) =>
                choose(
                  item,
                  replacement.target.itemId,
                  next === "change" ? "END" : "KEEP"
                )
              }
            />
          )
        )}
        {(isProjectIncluded(item) ? item.taskChanges : []).map((change) =>
          workspaceId && projectId ? (
            <TaskChangeSuggestion
              key={change.target.itemId}
              change={change}
              confirmed={confirmed}
              included={isProjectIncluded(item)}
              context={contextFor(
                item,
                change.target,
                undefined,
                change.reason
              )}
              task={tasksById.get(change.target.itemId)}
              noteId={noteId}
              choices={assigneeChoices}
              duplicate={taskConflicts.duplicates.has(change.target.itemId)}
              choice={choiceOf(change.decision)}
              taskState={taskStateOf(change)}
              onRetryTask={() => void tasksQuery.refetch()}
              disabled={!editable || saving || !isProjectIncluded(item)}
              onChoose={(next, taskChange) =>
                editor.updateItem(item.itemId, {
                  decisions: [
                    {
                      targetId: change.target.itemId,
                      decision: next === "change" ? "APPLY" : "KEEP",
                      taskChange,
                    },
                  ],
                })
              }
            />
          ) : (
            <p
              key={change.target.itemId}
              className="rounded-control bg-[var(--el-canvas-soft)] px-3 py-2.5 text-xs text-[var(--el-muted)]"
            >
              {tBlocked("tasksLoading")}
            </p>
          )
        )}
        {relationsOf(item)
          .filter((relation) => !cardedRelation(item, relation))
          .map((relation) => (
            <RelationSuggestion
              key={relation.key}
              relation={relation}
              workspaceId={workspaceId}
              segments={segments}
              onSelectItem={showItem}
              onOpenScript={onOpenScript}
            />
          ))}
      </div>
    ) : null;

  const scriptState = transcriptQuery.isPending
    ? ("pending" as const)
    : transcript
      ? ("ready" as const)
      : ("failed" as const);
  const quotesFor = (item: ReviewItem) => (
    <EvidenceQuotes
      quotes={quotesOf(item, segments)}
      authored={item.originalProposalRef === null}
      scriptState={scriptState}
      onRetryScript={() => void transcriptQuery.refetch()}
      resolveSpeaker={resolveSpeaker}
      onOpenScript={onOpenScript}
    />
  );
  const panelDetailOf = (item: ReviewItem) => (
    <ItemDetail
      item={item}
      summary={summary}
      itemsById={itemsById}
      onSelectItem={showItem}
      onSelectAgenda={(agendaId) => {
        setView("summary");
        window.location.hash = `summary-agenda-${agendaId}`;
      }}
      suggestions={suggestionsOf(item)}
      trail={
        <ItemTrail
          noteId={noteId}
          item={item}
          segments={segments}
          scriptState={scriptState}
          onRetryScript={() => void transcriptQuery.refetch()}
          resolveSpeaker={resolveSpeaker}
          onOpenScript={onOpenScript}
        />
      }
    />
  );

  const confirm = async () => {
    if (confirmBlocked || approve.isPending) return false;
    track("review_confirmation_clicked", { workspace_id: workspaceId });
    const body = {
      reviewId: review.reviewId,
      reviewRevision: review.reviewVersion,
      projectSelectionConfirmed: true,
    };
    const key = JSON.stringify(body);
    if (lastRequest.current?.body !== key)
      lastRequest.current = { body: key, id: newRequestId() };
    setApproveError(null);
    try {
      await approve.mutateAsync({
        noteId,
        data: { requestId: lastRequest.current.id, ...body },
      });
      toast.success(t("confirmed"));
      moveFlowStatus(queryClient, noteId, "CONFIRMED");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetAnalysisFlowQueryKey(noteId),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetMeetingReviewQueryKey(noteId),
        }),
        queryClient.invalidateQueries({
          predicate: (query) => isProjectTaskQueryKey(query.queryKey),
        }),
      ]);
      return true;
    } catch (error) {
      setApproveError({
        version: review.reviewVersion,
        message: errorMessageOf(error, t("confirmFailed")),
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetMeetingReviewQueryKey(noteId),
        }),
        errorCodeOf(error) === "PROJECT_KNOWLEDGE_CONFLICT"
          ? queryClient.invalidateQueries({
              predicate: ({ queryKey }) => isProjectTaskQueryKey(queryKey),
            })
          : Promise.resolve(),
      ]);
      return false;
    }
  };

  const selected = openItemId ? itemsById.get(openItemId) : undefined;

  const lengthMs = transcript
    ? meetingLengthOf(transcript.recording.durationMs, transcript)
    : null;
  const included = items.filter((item) => item.included);
  const marks = included.flatMap((item) => {
    if (item.kind !== "DECISION" && item.kind !== "ACTION_ITEM") return [];
    const atMs = citedAt(item);
    return atMs === null
      ? []
      : [{ itemId: item.itemId, kind: item.kind, atMs, content: item.content }];
  });
  const summaryMarkdown = () =>
    reviewToMarkdown({
      doc,
      note: { ...noteMeta!, durationMs: lengthMs ?? undefined },
      summary,
      topics: digests,
      sections,
      confirmed,
      context: {
        whenOf: citedAt,
        topicTitleOf: (item) => {
          const ordinal = topicOf(item.itemId);
          return ordinal === null ? null : topicTitleOf(ordinal) || null;
        },
      },
    });
  const exportSources =
    noteMeta && transcript
      ? widerExports({
          queryClient,
          noteId,
          note: { ...noteMeta, durationMs: lengthMs ?? undefined },
          participants,
          sharedBy: currentUserName ?? null,
          confirmed,
          headline:
            summary?.status === "SUCCEEDED"
              ? (summary.headline?.text ?? null)
              : null,
          lead:
            summary?.status === "SUCCEEDED"
              ? summary.lead.map((line) => line.text)
              : [],
          topics: digests,
          sections,
          citedAt,
          unfiledOpen: unfiledOpen(items, topicOf),
          unnamedSpeakers: unnamedSpeakers.length,
          doc,
        })
      : undefined;
  const preparePdf: PrepareMinutesPdf = async (include, signal) => {
    if (refreshingAnalysis || refreshFailed) throw new Error(t("pdfStale"));
    if (!exportSources) throw new Error(t("pdfSourcesFailed"));
    const doc = await exportSources.minutes(include);
    signal?.throwIfAborted();
    return { blob: await renderPdf(doc, signal), fileName: doc.fileName };
  };
  const wider = exportSources
    ? { ...exportSources, preparePdf, version: exportVersion }
    : undefined;
  const isMine = (item: ReviewItem) =>
    Boolean(currentUserId) &&
    item.assignee?.type === "USER" &&
    item.assignee.id === currentUserId;

  const relationsNotice =
    relationsStatus === "PENDING" ||
    relationsStatus === "FAILED" ||
    relationsStatus === "SKIPPED" ? (
      <p
        role={relationsStatus === "FAILED" ? "alert" : "status"}
        className="pb-4 text-sm leading-6 text-[var(--el-muted)]"
      >
        {t(`relations.${relationsStatus}`)}
      </p>
    ) : projectId && linksQuery.isError && !refreshFailed ? (
      <InlineRetry
        variant="line"
        label={t("linksFailed")}
        onRetry={() => void linksQuery.refetch()}
        className="pb-4"
      />
    ) : projectId && (linksQuery.isPending || refreshingAnalysis) ? (
      <p
        role="status"
        className="pb-4 text-sm leading-6 text-[var(--el-muted)]"
      >
        {t("linksLoading")}
      </p>
    ) : null;

  return (
    <div className="flex min-h-full flex-col">
      <BoardShell>
        <ReviewHead
          meta={noteMeta}
          participants={participants}
          lengthMs={lengthMs}
          confirmed={confirmed}
          mapHref={
            workspaceId && projectId
              ? `/w/${workspaceId}/projects/${projectId}`
              : undefined
          }
          aside={
            <div className="flex items-center gap-2">
              <ReviewActions
                disabled={
                  !noteMeta ||
                  summaryQuery.isPending ||
                  (summaryQuery.isError && !summary)
                }
                build={summaryMarkdown}
                material={
                  noteMeta && !transcript
                    ? transcriptQuery.isError
                      ? "failed"
                      : "loading"
                    : undefined
                }
                onRetryMaterial={() => void transcriptQuery.refetch()}
                wider={wider}
                onSendEmail={() => setMailOpen(true)}
              />
              <SegmentedControl
                label={t("viewLabel")}
                value={view}
                options={VIEWS.map((value) => ({
                  value,
                  label: t(`views.${value}`),
                }))}
                onChange={setView}
              />
            </div>
          }
        />

        {refreshFailed ? (
          <InlineRetry
            variant="line"
            label={t("refreshFailed")}
            onRetry={() => setRefreshAttempt((attempt) => attempt + 1)}
            className="pt-4"
          />
        ) : null}
        {reviewQuery.isError && !refreshFailed ? (
          <InlineRetry
            variant="line"
            label={t("reviewRefreshFailed")}
            onRetry={() => void reviewQuery.refetch()}
            className="pt-4"
          />
        ) : null}
        <div className="pt-4">
          <SpeakerNudgeBanner noteId={noteId} />
        </div>
        {assigneeFailed ? (
          <InlineRetry
            variant="line"
            label={t("assigneesFailed")}
            onRetry={retryAssignees}
            className="pb-4 text-xs text-[var(--el-muted)]"
          />
        ) : null}
        {firstMissingApply && canEdit && !confirmed ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm text-[var(--el-muted)]"
          >
            <span>{t("missingChoice")}</span>
            <button
              type="button"
              onClick={() => showItem(firstMissingApply.itemId, true)}
              className="underline underline-offset-4"
            >
              {t("goToChoice")}
            </button>
          </div>
        ) : null}
        {flow?.status === "REVIEWABLE" &&
        (flow.retryable ||
          [relationsStatus, enrichmentStatus].some(
            (status) => status === "PENDING" || status === "FAILED"
          )) ? (
          <PendingAnalysisRetry
            noteId={noteId}
            retryable={flow.retryable}
            flowUpdatedAt={flowUpdatedAt}
            disabled={
              !editable || saving || refreshingAnalysis || refreshFailed
            }
          />
        ) : null}

        <div
          key={view}
          className="animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none"
        >
          {view === "summary" ? (
            <>
              {lengthMs !== null ? (
                <MeetingMap
                  lengthMs={lengthMs}
                  chapters={digests.flatMap((topic) =>
                    topic.startMs === null
                      ? []
                      : [
                          {
                            ordinal: topic.ordinal,
                            title: topic.title,
                            startMs: topic.startMs,
                          },
                        ]
                  )}
                  marks={marks}
                  onSelect={showItem}
                />
              ) : null}
              <div className="pt-10">
                <ReviewOverview
                  summary={summary}
                  pending={summaryQuery.isPending}
                  failed={summaryQuery.isError && !summary}
                  onRetry={() => void summaryQuery.refetch()}
                />
                <TopicIndex
                  noteId={noteId}
                  topics={digests}
                  onOpenTimeline={onOpenTimeline}
                  links={meetingLinks}
                  workspaceId={workspaceId}
                  projectId={projectId}
                />
                {relationsNotice}
                {enrichmentStatus === "PENDING" ||
                enrichmentStatus === "FAILED" ||
                enrichmentStatus === "SKIPPED" ? (
                  <p
                    role={enrichmentStatus === "FAILED" ? "alert" : "status"}
                    className="pb-4 text-sm leading-6 text-[var(--el-muted)]"
                  >
                    {t(`enrichment.${enrichmentStatus}`)}
                  </p>
                ) : null}
                {sections.map((section) => (
                  <ReviewSection
                    key={section.key}
                    section={section}
                    whenOf={citedAt}
                    isMine={isMine}
                    canEdit={editable}
                    choices={assigneeChoices}
                    openItemId={openItemId}
                    busyItemId={editor.busyItemId}
                    conflictItemId={editor.conflictItemId}
                    conflictMessage={editor.conflictMessage}
                    adding={editor.adding}
                    hint={
                      !confirmed && section.key === "DECISION"
                        ? t("switchHint")
                        : undefined
                    }
                    aside={
                      section.key === "ACTION_ITEM" && unnamedAssigned > 0 ? (
                        <>
                          <span>
                            {t("unnamedAssigned", { count: unnamedAssigned })}
                          </span>
                          <button
                            type="button"
                            onClick={onOpenTranscript}
                            className="inline-flex h-[26px] items-center rounded-full border border-[var(--el-hairline-strong)] px-2.5 text-xs font-medium text-[var(--el-ink)] hover:bg-[var(--el-canvas-soft)]"
                          >
                            {t("nameSpeakers")}
                          </button>
                        </>
                      ) : undefined
                    }
                    onToggleItem={toggleItem}
                    onSaveItem={editor.updateItem}
                    onAddItem={(kind, content) =>
                      editor.addItem({ kind, content, citations: [] })
                    }
                    onDismissConflict={editor.dismissConflict}
                    renderDetail={quotesFor}
                    suggestionsOf={suggestionsOf}
                  />
                ))}
              </div>
            </>
          ) : (
            <div>
              {relationsNotice}
              {summary?.status === "SUCCEEDED" && overviewText(summary) ? (
                <p className="mb-5 text-base leading-7 text-[var(--el-ink)]">
                  {overviewText(summary)}
                </p>
              ) : null}
              {summaryQuery.isError && !summary ? (
                <InlineRetry
                  variant="line"
                  label={t("graphSummaryFailed")}
                  onRetry={() => void summaryQuery.refetch()}
                  className="py-6"
                />
              ) : summaryQuery.isPending ? (
                <Skeleton
                  aria-label={t("graphLoading")}
                  className={`aspect-[840/520] ${GRAPH_WIDE} rounded-block`}
                />
              ) : (
                <div className={GRAPH_WIDE}>
                  <ReviewGraph
                    agendaLinks={meetingLinks.byAgendaId}
                    summary={
                      summary ?? {
                        noteId,
                        status: "NOT_AVAILABLE",
                        resultVersion: null,
                        headline: null,
                        lead: [],
                        topics: [],
                        agendas: [],
                      }
                    }
                    items={items}
                    selectedItemId={openItemId}
                    onSelect={setOpenItemId}
                  />
                </div>
              )}
              {selected ? (
                <div
                  key={selected.itemId}
                  data-item-id={selected.itemId}
                  data-item-scroll-target
                  className="mt-4 overflow-hidden rounded-block border border-[var(--el-hairline)] bg-[var(--el-surface-card)] shadow-e2 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-out motion-reduce:animate-none"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-2 border-b border-[var(--el-hairline-soft)] px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap text-[var(--el-ink)]">
                      <RoleDot role={roleOfItem(selected, summary)} />
                      {tKind(selected.kind)}
                    </span>
                    <span className="col-span-2 row-start-2 min-w-0 whitespace-normal break-words text-sm leading-6 font-medium text-[var(--el-ink)] [overflow-wrap:anywhere]">
                      {selected.content}
                    </span>
                    <button
                      type="button"
                      aria-label={tAction("close")}
                      className="col-start-2 row-start-1 text-[var(--el-muted-soft)] hover:text-[var(--el-ink)]"
                      onClick={() => setOpenItemId(null)}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <div className="p-3">{panelDetailOf(selected)}</div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </BoardShell>

      {canEdit && !confirmed ? (
        <ConfirmBar
          summary={confirmSummary}
          decisions={
            items.filter(
              (item) => isProjectIncluded(item) && item.kind === "DECISION"
            ).length
          }
          pending={approve.isPending}
          blocked={confirmBlocked}
          unchosen={earlierBlock ? 0 : unchosen}
          onShowUnchosen={
            firstUnchosen && view === "summary"
              ? () => showItem(firstUnchosen.itemId)
              : undefined
          }
          error={
            approveError?.version === review.reviewVersion
              ? approveError.message
              : null
          }
          raised={dockRaised}
          onConfirm={confirm}
        />
      ) : null}

      {noteMeta && wider ? (
        <ShareMailDialog
          open={mailOpen}
          onOpenChange={setMailOpen}
          noteId={noteId}
          workspaceId={workspaceId}
          meeting={noteMeta}
          attendees={participants.flatMap((person) =>
            person.email
              ? [{ name: person.name ?? person.email, email: person.email }]
              : []
          )}
          unnamedSpeakers={unnamedSpeakers.flatMap((speaker) =>
            speaker.type === "SPEAKER_LABEL"
              ? [fallbackNames.speaker(speaker.label)]
              : []
          )}
          buildPdf={async (include) => (await preparePdf(include)).blob}
          preparePdf={preparePdf}
          version={exportVersion}
        />
      ) : null}
    </div>
  );
}

const GRAPH_WIDE =
  "relative left-1/2 w-[max(100%,min(90cqw,1100px))] -translate-x-1/2";

function useAnalysisRefresh<Key>({
  refreshKey,
  paused,
  noteId,
  projectId,
  workspaceId,
}: {
  refreshKey: Key;
  paused: boolean;
  noteId: string;
  projectId: string | undefined;
  workspaceId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [loadedRefreshKey, setLoadedRefreshKey] = useState(refreshKey);
  const [failedRefreshKey, setFailedRefreshKey] = useState<
    typeof refreshKey | null
  >(null);
  const refreshFailed = failedRefreshKey === refreshKey;
  const refreshingAnalysis = loadedRefreshKey !== refreshKey && !refreshFailed;
  useEffect(() => {
    if (paused || loadedRefreshKey === refreshKey || refreshFailed) return;
    let active = true;
    const reload = async (queryKey: readonly unknown[]) => {
      // 첫 응답을 기다리는 쿼리는 invalidate만으로 이전 요청이 취소되지 않는다.
      await queryClient.cancelQueries({ queryKey });
      if (active)
        return queryClient.invalidateQueries(
          { queryKey },
          { throwOnError: true }
        );
    };
    const requiredKeys = [
      getGetMeetingReviewQueryKey(noteId),
      getGetMeetingReviewSummaryQueryKey(noteId),
      getGetNoteTranscriptQueryKey(noteId),
      ...(projectId
        ? [getGetProjectMeetingLinksQueryKey(projectId, { noteId })]
        : []),
    ];
    void Promise.all([
      ...requiredKeys.map(reload),
      projectId && workspaceId
        ? queryClient.invalidateQueries({
            queryKey: getGetProjectTasksQueryKey(workspaceId, projectId),
          })
        : Promise.resolve(),
    ])
      .then(() => {
        if (!active) return;
        // 오프라인으로 멈춘 조회도 resolve되므로 실제 무효화가 해제됐는지 확인한다.
        if (
          requiredKeys.some(
            (key) => queryClient.getQueryState(key)?.isInvalidated !== false
          )
        ) {
          throw new Error("analysis refresh did not settle");
        }
        setLoadedRefreshKey(refreshKey);
      })
      .catch(() => {
        if (active) setFailedRefreshKey(refreshKey);
      });
    return () => {
      active = false;
    };
  }, [
    refreshKey,
    loadedRefreshKey,
    refreshFailed,
    paused,
    noteId,
    projectId,
    workspaceId,
    queryClient,
  ]);
  return { refreshFailed, refreshingAnalysis };
}

function BoardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container/note flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-[calc(680px+2*var(--note-gutter))] flex-1 px-[var(--note-gutter)] pt-8 pb-10 sm:pt-10">
        {children}
      </div>
    </div>
  );
}

export function ReviewBoardSkeleton() {
  const t = useTranslations("notes.review");
  return (
    <BoardShell>
      <div aria-label={t("board.loading")}>
        <div className="flex min-h-8 items-center gap-3">
          <Skeleton className="h-5 w-12 rounded-chip" />
          <Skeleton className="ml-auto h-8 w-[120px] rounded-full" />
        </div>
        <Skeleton className="mt-2.5 h-[38px] w-[60%] rounded-chip" />
        <div className="mt-3 flex gap-1.5 pb-1">
          {[132, 72, 112].map((width) => (
            <Skeleton
              key={width}
              className="h-[26px] rounded-control"
              style={{ width }}
            />
          ))}
        </div>
        <div className="pt-[62px]">
          <ReviewOverview summary={null} pending />
          {REVIEW_SECTIONS.slice(0, 2).map((section) => (
            <SectionBlock
              key={section.key}
              title={t(`sections.names.${section.key}`)}
            >
              <div className="border-t border-[var(--el-hairline-soft)]">
                {["78%", "64%", "71%"].map((width) => (
                  <div
                    key={width}
                    className="flex h-[47px] items-center border-b border-[var(--el-hairline-soft)]"
                  >
                    <Skeleton className="h-4 rounded-chip" style={{ width }} />
                  </div>
                ))}
              </div>
            </SectionBlock>
          ))}
        </div>
      </div>
    </BoardShell>
  );
}
