"use client";

import { reviewToMarkdown } from "@/lib/notes/review/markdown";
import { createMinutesPdfRenderer } from "@/components/notes/minutes/render-minutes-pdf";
import type { PrepareMinutesPdf } from "@/components/notes/minutes/render-minutes-pdf";
import { widerExports } from "@/lib/notes/minutes/exports";
import { overviewText, summaryTopics } from "@/lib/notes/review/summary";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SegmentedControl } from "@/components/heymoa/segmented-control";
import { ConfirmBar } from "@/components/notes/review/confirm-bar";
import { EvidenceQuotes } from "@/components/notes/review/evidence-quotes";
import { ItemDetail } from "@/components/notes/review/item-detail";
import { ItemTrail } from "@/components/notes/review/item-trail";
import { MeetingMap } from "@/components/notes/review/meeting-map";
import { ReviewGraph } from "@/components/notes/review/review-graph";
import { ReviewActions } from "@/components/notes/review/review-actions";
import { ShareMailDialog } from "@/components/notes/review/share-mail-dialog";
import { ReviewHead } from "@/components/notes/review/review-head";
import { ReviewOverview } from "@/components/notes/review/review-overview";
import { ReviewSection } from "@/components/notes/review/review-section";
import { TopicIndex } from "@/components/notes/review/topic-index";
import { RoleDot, roleOfItem } from "@/components/notes/review/role-dot";
import { SectionBlock } from "@/components/notes/review/section-block";
import {
  RelationContext,
  RelationSuggestion,
  ReplacementSuggestion,
  TaskChangeSuggestion,
} from "@/components/notes/review/suggestion-row";
import { SpeakerNudgeBanner } from "@/components/notes/speaker-nudge-banner";
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
import { moveFlowStatus } from "@/lib/notes/review/flow-cache";
import {
  citedAtOf,
  meetingLengthOf,
  quotesOf,
  segmentStarts,
} from "@/lib/notes/review/moments";
import { isProjectTaskQueryKey } from "@/lib/tasks/task-groups";
import {
  KIND_LABEL,
  REVIEW_SECTIONS,
  isSummaryKind,
  isSummarySection,
  sectionsOf,
  type ReviewItem,
} from "@/lib/notes/review/sections";
import {
  topicDigests,
  topicIndex,
  topicNumber,
} from "@/lib/notes/review/topics";
import { useReviewEditor } from "@/lib/notes/review/use-review-editor";
import {
  createSpeakerIdentityResolver,
  type SpeakerFace,
} from "@/lib/transcription/speaker-identity";
import { toast } from "@/lib/ui/toast";

type View = "summary" | "graph";

const VIEWS = [
  { value: "summary", label: "요약" },
  { value: "graph", label: "그래프" },
] as const;

const TSID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** `Collapse` 의 높이 전환(200ms)이 끝나는 때. 그 뒤에 재야 줄의 자리가 맞다 */
const COLLAPSE_SETTLE_MS = 240;

/**
 * 확정 요청 식별자. 같은 본문을 다시 보낼 때만 같은 값을 쓴다 — 서버가 재전송을 한 결과로 모은다.
 * 서버가 TSID 로 검증하므로 13자이고, 64비트에 맞게 첫 글자는 0~7 이다.
 */
function newRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(13));
  return Array.from(
    bytes,
    (byte, index) => TSID_ALPHABET[index === 0 ? byte % 8 : byte % 32]
  ).join("");
}

/** 어느 주제에도 들지 않은 질문 · 이슈. 회의록의 「기타」 미결이다 */
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
}: {
  noteId: string;
  flow?: MeetingAnalysisFlowResponseData;
  workspaceId: string | undefined;
  projectId: string | undefined;
  confirmed: boolean;
  canEdit: boolean;
  /** 머리에 세울 회의 제목 · 시각 · 프로젝트. 셸이 한 번 읽어 내린다 */
  noteMeta?: NoteMeta | null;
  /** 주소는 「회의록 보내기」의 받는 사람 후보가 쓴다 */
  participants: (SpeakerFace & { email?: string | null })[];
  /** 「나」 표시. 담당이 이 사람이면 붙는다 */
  currentUserId?: string | null;
  /** 회의록 PDF 의 「공유」 칸. 받는 쪽이 누구에게 물어야 할지 안다 */
  currentUserName?: string | null;
  /** 「이 회의에 대해 물어보기」 알약이 아래 가운데에 떠 있다. 검토 막대를 그 위로 올린다 */
  dockRaised?: boolean;
  onOpenScript: (segmentId: string) => void;
  onOpenTranscript: () => void;
  onOpenTimeline?: () => void;
}) {
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
  // 회의 간 연결은 이 회의가 양 끝인 것만 받는다. 프로젝트 없는 회의는 연결이 없다.
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
  const tasksQuery = useGetProjectTasks(workspaceId ?? "", projectId ?? "", {
    query: { enabled: Boolean(workspaceId && projectId), staleTime: 0, refetchOnMount: "always" },
  });
  // 거절 까닭은 확정 줄과 확인창에 남기므로 전역 토스트를 끈다(두 번 뜨지 않게).
  const approve = useApproveMeetingReview({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [approveError, setApproveError] = useState<{ version: number; message: string } | null>(null);
  const regionStatus = (region: string) =>
    flow?.regions?.find((row) => row.region === region)?.status;
  const relationsStatus = regionStatus("RELATIONS");
  const enrichmentStatus = regionStatus("ITEM_ENRICHMENT");
  const flowSignature = `${flow?.status}:${(flow?.regions ?? []).map((row) => `${row.region}:${row.status}`).join(",")}`;
  const [loadedFlowSignature, setLoadedFlowSignature] = useState(flowSignature);
  const refreshingAnalysis = loadedFlowSignature !== flowSignature;
  useEffect(() => {
    // 저장 중에는 늦은 GET을 늘리지 않는다. 상태 변화는 저장이 끝난 뒤 읽는다.
    if (editor.busyItemId !== null || loadedFlowSignature === flowSignature)
      return;
    let active = true;
    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: getGetMeetingReviewQueryKey(noteId),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetMeetingReviewSummaryQueryKey(noteId),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetNoteTranscriptQueryKey(noteId),
      }),
      projectId
        ? queryClient.invalidateQueries({
            queryKey: getGetProjectMeetingLinksQueryKey(projectId, { noteId }),
          })
        : Promise.resolve(),
      projectId && workspaceId
        ? queryClient.invalidateQueries({
            queryKey: getGetProjectTasksQueryKey(workspaceId, projectId),
          })
        : Promise.resolve(),
    ]).then(() => {
      if (active) setLoadedFlowSignature(flowSignature);
    });
    return () => {
      active = false;
    };
  }, [
    flowSignature,
    loadedFlowSignature,
    editor.busyItemId,
    noteId,
    projectId,
    workspaceId,
    queryClient,
  ]);

  const [view, setView] = useState<View>("summary");
  const [mailOpen, setMailOpen] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const lastRequest = useRef<{ body: string; id: string } | null>(null);

  const review = okData(reviewQuery.data);
  const summary = okData(summaryQuery.data);
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
  // 요약 보기는 결정 · 할 일만 세운다(APP-864). 이슈 · 질문 · 참고는 그래프 보기에만 선다.
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
  const exportVersion = useMemo(() => JSON.stringify({ noteId, noteMeta, confirmed, summary, items, transcript, participants, currentUserName }), [noteId, noteMeta, confirmed, summary, items, transcript, participants, currentUserName]);
  // 항목이 나온 때는 인용한 스크립트 구간으로 계산한다(APP-865) — server 는 항목에 시각을 싣지 않는다.
  const starts = useMemo(() => segmentStarts(segments), [segments]);
  const citedAt = useCallback(
    (item: ReviewItem) => citedAtOf(item, starts),
    [starts]
  );
  const digests = useMemo(
    () => topicDigests(summary, itemsById, citedAt),
    [summary, itemsById, citedAt]
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
    () => createSpeakerIdentityResolver(speakers ?? [], participants),
    [speakers, participants]
  );

  if (reviewQuery.isLoading) return <ReviewBoardSkeleton />;
  if (!review) {
    return (
      <BoardShell>
        <InlineRetry
          variant="line"
          label="검토본을 불러오지 못했습니다."
          onRetry={() => void reviewQuery.refetch()}
          className="pt-6"
        />
      </BoardShell>
    );
  }

  const confirmSummary = confirmSummaryOf(items);
  const taskConflicts = taskApplyConflictsOf(items, (id) => tasksById.get(id)?.revision);
  const taskStateOf = (
    change: ReviewItem["taskChanges"][number]
  ): "pending" | "ready" | "failed" => {
    const revision = tasksById.get(change.target.itemId)?.revision;
    const behind =
      revision !== undefined &&
      revision < (change.draft?.expectedRevision ?? change.target.revision);
    if (tasksQuery.isPending || (behind && tasksQuery.isFetching)) return "pending";
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

  // 제안의 선택은 검토본에 저장한다 — 새로고침하거나 다른 참석자가 열어도 같은 선택이 보인다.
  const choose = (
    item: ReviewItem,
    targetId: string,
    decision: "END" | "KEEP"
  ) => editor.updateItem(item.itemId, { decisions: [{ targetId, decision }] });
  const saving = editor.busyItemId !== null;
  const hasTask = (taskId: string) => tasksById.has(taskId);
  // **화면에 서는 항목의 제안만 본다.** 요약 보기에 없는 이슈 · 질문 · 참고의 제안은 고를 곳이 없어,
  // 세면 검토 완료가 영영 막힌다. 고르지 않은 제안은 확정이 건너뛴다 — 이전 결정을 끝내지 않고 할 일도
  // 바꾸지 않는다(그래프 보기에서 고르면 그 선택대로 된다).
  const unchosen = unchosenSuggestionCount(gateItems, hasTask);
  const blockInput = {
    saving,
    duplicateApplies: taskConflicts.duplicates.size,
    staleApplies: taskConflicts.stale.size,
    hasTaskChanges: gateItems.some(
      (item) => item.included && item.taskChanges.length > 0
    ),
    tasks:
      !workspaceId || !projectId || tasksQuery.isPending ||
      gateItems.some((item) => item.included && item.taskChanges.some((change) => taskStateOf(change) === "pending"))
        ? ("pending" as const)
        : // 이미 읽은 할 일은 재조회가 실패해도 쓴다. 제안보다 낮은 판은 확인하지 못한 것이므로 다시 읽는다.
          tasks && !gateItems.some((item) => item.included && item.taskChanges.some((change) => taskStateOf(change) === "failed"))
          ? ("ready" as const)
          : ("failed" as const),
  };
  // 확정은 되돌릴 수 없다. 저장 · 반영이 끝나지 않았거나 고를 제안이 아직 안 섰으면 막고 까닭을 적는다.
  // 고를 제안이 남은 것보다 앞선 까닭이 있으면 그것을 먼저 말한다 — 막대가 그 까닭을 그대로 쓴다.
  const analysisBlock =
    relationsStatus === "PENDING"
      ? "충돌과 이어짐 확인이 끝나면 검토를 완료할 수 있습니다"
      : enrichmentStatus === "PENDING"
        ? "담당과 기한 정리가 끝나면 검토를 완료할 수 있습니다"
        : null;
  const earlierBlock =
    analysisBlock ?? confirmBlockReason({ ...blockInput, unchosen: 0 });
  const confirmBlocked =
    analysisBlock ?? confirmBlockReason({ ...blockInput, unchosen });
  // 막대의 「제안으로 가기」가 데려갈 줄. 요약 보기에 선 줄만이다.
  const firstUnchosen = sections
    .flatMap((section) => section.items)
    .find((item) => unchosenSuggestionCount([item], hasTask) > 0);

  const toggleItem = (itemId: string) =>
    setOpenItemId((current) => (current === itemId ? null : itemId));

  /**
   * 그 줄로 간다. 접힌 「더 불러오기」가 펼쳐지고 앞서 펼쳐 둔 줄이 접히는 높이 전환(`Collapse` 200ms)이
   * 끝난 뒤에 재야 자리가 맞다 — 전환 중에 재면 뒤쪽 줄은 펼침이 끝난 뒤 화면 밖에 남는다.
   */
  const scrollToItem = (itemId: string) => {
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    window.setTimeout(
      () =>
        document
          .querySelector(`[data-item-scroll-target][data-item-id="${CSS.escape(itemId)}"]`)
          ?.scrollIntoView?.({
            block: "center",
            behavior: reduce ? "auto" : "smooth",
          }),
      reduce ? 0 : COLLAPSE_SETTLE_MS
    );
  };
  const showItem = (itemId: string) => {
    const target = itemsById.get(itemId);
    if (target && !isSummaryKind(target.kind)) setView("graph");
    setOpenItemId(itemId);
    scrollToItem(itemId);
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
      relationsOf(item).length >
    0 ? (
      <div className="space-y-1.5">
        {item.replacements.map((replacement) => (
          <ReplacementSuggestion
            key={replacement.target.itemId}
            replacement={replacement}
            context={contextFor(
              item,
              replacement.target,
              replacement.kind,
              replacement.reason
            )}
            choice={choiceOf(replacement.decision)}
            disabled={!editable || !item.included || saving}
            onChoose={(next) =>
              choose(
                item,
                replacement.target.itemId,
                next === "change" ? "END" : "KEEP"
              )
            }
          />
        ))}
        {item.taskChanges.map((change) =>
          workspaceId && projectId ? (
            <TaskChangeSuggestion
              key={change.target.itemId}
              change={change}
              confirmed={confirmed}
              included={item.included}
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
              disabled={!editable || saving || !item.included}
              onChoose={(next, taskChange) => editor.updateItem(item.itemId, {
                decisions: [{ targetId: change.target.itemId, decision: next === "change" ? "APPLY" : "KEEP", taskChange }],
              })}
            />
          ) : (
            <p
              key={change.target.itemId}
              className="rounded-control bg-[var(--el-canvas-soft)] px-3 py-2.5 text-xs text-[var(--el-muted)]"
            >
              기존 할 일 변경 제안을 불러오는 중입니다
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
  // 요약 보기의 줄을 펼치면 근거 발언이 선다(APP-865). 수정 기록 · 관련 항목은 그래프의 상세 패널에 남는다.
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
    const body = {
      reviewId: review.reviewId,
      reviewRevision: review.reviewVersion,
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
      toast.success("검토를 완료했습니다");
      moveFlowStatus(queryClient, noteId, "CONFIRMED");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetAnalysisFlowQueryKey(noteId),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetMeetingReviewQueryKey(noteId),
        }),
        // 노트의 프로젝트를 아직 모를 수도 있어 할 일 · 할 일 이력 조회를 통째로 다시 읽힌다.
        queryClient.invalidateQueries({
          predicate: (query) => isProjectTaskQueryKey(query.queryKey),
        }),
      ]);
      return true;
    } catch (error) {
      // 서버 문구를 확정 줄에 남긴다. 판이 낡아 거절됐을 수 있으니 검토본도 다시 읽는다.
      setApproveError({ version: review.reviewVersion, message: errorMessageOf(error, "검토를 완료하지 못했습니다.") });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetMeetingReviewQueryKey(noteId) }),
        errorCodeOf(error) === "PROJECT_KNOWLEDGE_CONFLICT"
          ? queryClient.invalidateQueries({ predicate: ({ queryKey }) => isProjectTaskQueryKey(queryKey) })
          : Promise.resolve(),
      ]);
      return false;
    }
  };

  const selected = openItemId ? itemsById.get(openItemId) : undefined;

  const lengthMs = transcript
    ? meetingLengthOf(transcript.recording.durationMs, segments)
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
  // 복사 · PDF · 메일이 같은 회의록 재료를 쓴다 — 셋이 따로 조립하면 받은 PDF 와 내려받은 PDF 가 갈라진다.
  // 녹취록이 온 뒤에 연다 — 항목 시각 · 안건 시작 · 회의 길이를 녹취록에서 잰다. **받은 녹취록이 있는지로 가린다**:
  // isSuccess 로 가리면 다시 받기가 실패할 때 열린 PDF · 메일 창이 사라지고 쓰던 받는 사람 · 메시지도 날아갔다
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
        })
      : undefined;
  const preparePdf: PrepareMinutesPdf = async (include, signal) => {
    if (!exportSources) throw new Error("회의록 자료를 불러오지 못했습니다.");
    const doc = await exportSources.minutes(include);
    signal?.throwIfAborted();
    return { blob: await renderPdf(doc, signal), fileName: doc.fileName };
  };
  const wider = exportSources ? { ...exportSources, preparePdf, version: exportVersion } : undefined;
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
        {relationsStatus === "PENDING"
          ? "충돌과 이어짐을 확인하고 있습니다."
          : relationsStatus === "FAILED"
            ? "충돌과 이어짐을 분석하지 못했습니다."
            : "화자 정보를 확인하지 못해 충돌과 이어짐을 분석하지 않았습니다."}
      </p>
    ) : projectId && linksQuery.isError ? (
      <InlineRetry
        variant="line"
        label="회의 연결을 불러오지 못했습니다."
        onRetry={() => void linksQuery.refetch()}
        className="pb-4"
      />
    ) : projectId &&
      (linksQuery.isPending || refreshingAnalysis) ? (
      <p
        role="status"
        className="pb-4 text-sm leading-6 text-[var(--el-muted)]"
      >
        충돌과 이어짐을 불러오고 있습니다.
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
          aside={
            <div className="flex items-center gap-2">
              <ReviewActions
                // **요약을 못 받았으면 복사를 막는다.** 요약·주제가 빠진 문서가 성공 토스트와 함께 복사된다.
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
                // 발송 API 가 운영에 배포되기 전에는 목 환경에서만 연다 — 운영에서는 메일 항목을 세우지 않는다
                onSendEmail={() => setMailOpen(true)}
              />
              <SegmentedControl
                label="보기"
                value={view}
                options={VIEWS}
                onChange={setView}
              />
            </div>
          }
        />

        <div className="pt-4">
          <SpeakerNudgeBanner noteId={noteId} />
        </div>
        {assigneeFailed ? (
          <InlineRetry
            variant="line"
            label="담당으로 고를 사람 목록을 불러오지 못했습니다."
            onRetry={retryAssignees}
            className="pb-4 text-xs text-[var(--el-muted)]"
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
                  // **이미 든 요약이 있으면 재조회 실패로 덮지 않는다** (APP-1033). 캐시를 든 채 리패치만 실패해도
                  // `isError` 가 되는데, 그때 보이던 요약을 에러 줄로 바꾸면 재시도가 성공할 때까지 통째로 사라진다.
                  failed={summaryQuery.isError && !summary}
                  onRetry={() => void summaryQuery.refetch()}
                />
                <TopicIndex
                  noteId={noteId}
                  topics={digests}
                  onOpenTimeline={onOpenTimeline}
                  links={meetingLinks}
                  workspaceId={workspaceId}
                />
                {relationsNotice}
                {enrichmentStatus === "PENDING" ||
                enrichmentStatus === "FAILED" ||
                enrichmentStatus === "SKIPPED" ? (
                  <p
                    role={enrichmentStatus === "FAILED" ? "alert" : "status"}
                    className="pb-4 text-sm leading-6 text-[var(--el-muted)]"
                  >
                    {enrichmentStatus === "PENDING"
                      ? "담당과 기한을 정리하고 있습니다."
                      : enrichmentStatus === "FAILED"
                        ? "담당과 기한을 분석하지 못했습니다. 직접 지정할 수 있습니다."
                        : "화자 정보를 확인하지 못해 담당과 기한을 분석하지 않았습니다."}
                  </p>
                ) : null}
                {sections.map((section) => (
                  <ReviewSection
                    key={section.key}
                    section={section}
                    topicOf={topicOf}
                    topicTitleOf={topicTitleOf}
                    whenOf={citedAt}
                    isMine={isMine}
                    canEdit={editable}
                    choices={assigneeChoices}
                    openItemId={openItemId}
                    busyItemId={editor.busyItemId}
                    conflictItemId={editor.conflictItemId}
                    conflictMessage={editor.conflictMessage}
                    adding={editor.adding}
                    aside={
                      section.key === "ACTION_ITEM" && unnamedAssigned > 0 ? (
                        <>
                          <span>
                            이름 없는 화자에게 걸린 할 일 {unnamedAssigned}
                          </span>
                          <button
                            type="button"
                            onClick={onOpenTranscript}
                            className="inline-flex h-[26px] items-center rounded-full border border-[var(--el-hairline-strong)] px-2.5 text-xs font-medium text-[var(--el-ink)] hover:bg-[var(--el-canvas-soft)]"
                          >
                            화자 이름 붙이기
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
                <p className="mb-5 max-w-[60ch] text-base leading-7 break-keep text-[var(--el-ink)]">
                  {overviewText(summary)}
                </p>
              ) : null}
              {/* 조회가 실패했는데 「주제 묶음이 없다」고 말하면 없는 것처럼 읽힌다 */}
              {summaryQuery.isError && !summary ? (
                <InlineRetry
                  variant="line"
                  label="요약을 불러오지 못해 그래프를 그릴 수 없습니다."
                  onRetry={() => void summaryQuery.refetch()}
                  className="py-6"
                />
              ) : summaryQuery.isPending ? (
                // 요약이 오기 전에 「주제 묶음이 없다」고 말하지 않는다. 그래프 판 크기로 자리만 잡는다.
                <Skeleton
                  aria-label="그래프 불러오는 중"
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
                  <div className="flex items-center gap-2.5 border-b border-[var(--el-hairline-soft)] px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap text-[var(--el-ink)]">
                      <RoleDot role={roleOfItem(selected, summary)} />
                      {KIND_LABEL[selected.kind]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--el-ink)]">
                      {selected.content}
                    </span>
                    {topicOf(selected.itemId) !== null ? (
                      <span className="text-xs whitespace-nowrap text-[var(--el-muted)] max-sm:hidden">
                        {topicNumber(topicOf(selected.itemId)!)}{" "}
                        {
                          summaryTopics(summary).find(
                            (row) => row.ordinal === topicOf(selected.itemId)
                          )?.title
                        }
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label="닫기"
                      className="text-[var(--el-muted-soft)] hover:text-[var(--el-ink)]"
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
          decisions={included.filter((item) => item.kind === "DECISION").length}
          pending={approve.isPending}
          blocked={confirmBlocked}
          unchosen={earlierBlock ? 0 : unchosen}
          onShowUnchosen={
            firstUnchosen && view === "summary"
              ? // 접힌 「더 불러오기」 안의 줄은 펼쳐야 DOM 에 선다 — 펼치고 간다.
                () => showItem(firstUnchosen.itemId)
              : undefined
          }
          error={approveError?.version === review.reviewVersion ? approveError.message : null}
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
            speaker.type === "SPEAKER_LABEL" ? [`화자 ${speaker.label}`] : []
          )}
          // 「PDF로 내보내기」와 같은 생성기다 — 받는 사람이 받는 파일과 내려받은 파일이 같다
          buildPdf={async (include) => (await preparePdf(include)).blob}
          preparePdf={preparePdf}
          version={exportVersion}
        />
      ) : null}
    </div>
  );
}

/** 그래프만 글 칸(680)에서 벗어나 가용 폭의 90%(최대 1100)로 펼친다. 칸보다 좁아지면 칸 폭 그대로다. */
const GRAPH_WIDE =
  "relative left-1/2 w-[max(100%,min(90cqw,1100px))] -translate-x-1/2";

/** 회의록 문서 한 단(APP-865). 시안의 760 칸에서 좌우 여백을 뺀 680 이 글 폭이다. */
function BoardShell({ children }: { children: React.ReactNode }) {
  return (
    // 바깥 `@container` 는 그래프가 글 칸 밖으로 얼마나 넓어질 수 있는지(`cqw`) 재는 기준이다.
    <div className="@container/note flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-[calc(680px+2*var(--note-gutter))] flex-1 px-[var(--note-gutter)] pt-8 pb-10 sm:pt-10">
        {children}
      </div>
    </div>
  );
}

/** 검토본 조회 skeleton. 머리 · 섹션 제목은 고정 문구라 가리지 않고 값 자리만 막대로 둔다. */
export function ReviewBoardSkeleton() {
  return (
    <BoardShell>
      <div aria-label="검토본 불러오는 중">
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
            <SectionBlock key={section.key} title={section.label}>
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
