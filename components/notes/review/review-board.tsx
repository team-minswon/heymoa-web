"use client";

import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { SegmentedControl } from "@/components/heymoa/segmented-control";
import { ConfirmBar } from "@/components/notes/review/confirm-bar";
import { EvidenceQuotes } from "@/components/notes/review/evidence-quotes";
import { ItemDetail } from "@/components/notes/review/item-detail";
import { ItemTrail } from "@/components/notes/review/item-trail";
import { MeetingMap } from "@/components/notes/review/meeting-map";
import { ReviewGraph } from "@/components/notes/review/review-graph";
import { ReviewHead } from "@/components/notes/review/review-head";
import { ReviewOverview } from "@/components/notes/review/review-overview";
import { ReviewSection } from "@/components/notes/review/review-section";
import { TopicIndex } from "@/components/notes/review/topic-index";
import { RoleDot, roleOfItem } from "@/components/notes/review/role-dot";
import { SectionBlock } from "@/components/notes/review/section-block";
import {
  ReplacementSuggestion,
  TaskChangeSuggestion,
} from "@/components/notes/review/suggestion-row";
import { SpeakerNudgeBanner } from "@/components/notes/speaker-nudge-banner";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessageOf } from "@/lib/api/error-message";
import { okData } from "@/lib/api/ok-data";
import { getGetAnalysisFlowQueryKey } from "@/lib/api/generated/analysis/analysis";
import { useApproveMeetingReview } from "@/lib/api/generated/meeting-approval/meeting-approval";
import {
  getGetMeetingReviewQueryKey,
  useGetMeetingReview,
  useGetMeetingReviewSummary,
} from "@/lib/api/generated/meeting-review/meeting-review";
import { useGetProjectTasks } from "@/lib/api/generated/projects/projects";
import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";
import type { AssigneeChoice } from "@/lib/assignees/describe";
import { useAssigneeChoices } from "@/lib/assignees/use-assignee-choices";
import type { NoteMeta } from "@/lib/notes/copy-markdown";
import {
  choiceOf,
  confirmBlockReason,
  confirmSummaryOf,
  unchosenSuggestionCount,
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

export function ReviewBoard({
  noteId,
  workspaceId,
  projectId,
  confirmed,
  canEdit,
  noteMeta,
  participants,
  currentUserId,
  dockRaised = false,
  onOpenScript,
  onOpenTranscript,
  onOpenTimeline,
}: {
  noteId: string;
  workspaceId: string | undefined;
  projectId: string | undefined;
  confirmed: boolean;
  canEdit: boolean;
  /** 머리에 세울 회의 제목 · 시각 · 프로젝트. 셸이 한 번 읽어 내린다 */
  noteMeta?: NoteMeta | null;
  participants: SpeakerFace[];
  /** 「나」 표시. 담당이 이 사람이면 붙는다 */
  currentUserId?: string | null;
  /** 「이 회의에 대해 물어보기」 알약이 아래 가운데에 떠 있다. 검토 막대를 그 위로 올린다 */
  dockRaised?: boolean;
  onOpenScript: (segmentId: string) => void;
  onOpenTranscript: () => void;
  onOpenTimeline?: () => void;
}) {
  const queryClient = useQueryClient();
  const reviewQuery = useGetMeetingReview(noteId);
  const summaryQuery = useGetMeetingReviewSummary(noteId);
  const transcriptQuery = useGetNoteTranscript(noteId);
  const tasksQuery = useGetProjectTasks(workspaceId ?? "", projectId ?? "", {
    query: { enabled: Boolean(workspaceId && projectId) },
  });
  const editor = useReviewEditor(noteId);
  // 기존 할 일 반영은 제안 줄 안에서 돈다. 확정이 그 저장보다 앞서지 않게 여기서도 센다.
  const applyingTasks =
    useIsMutating({ mutationKey: ["updateProjectTask"] }) > 0;
  // 거절 까닭은 확정 줄과 확인창에 남기므로 전역 토스트를 끈다(두 번 뜨지 않게).
  const approve = useApproveMeetingReview({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [approveError, setApproveError] = useState<string | null>(null);

  const [view, setView] = useState<View>("summary");
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  /**
   * 할 일에는 반영했는데 선택 저장이 실패한 변경(`항목 id:할 일 id`). 반영은 할 일을 먼저 바꾸고 선택을 나중에 저장한다.
   * ponytail: 이 화면이 떠 있는 동안만 기억한다. 새로고침하면 잊어, 감춘 항목의 그 제안은 다시 고르지 않은 채
   * 확정될 수 있다(할 일 이력에는 남는다). 막으려면 반영과 선택을 server 가 한 번에 저장해야 한다.
   */
  const [unsavedApplies, setUnsavedApplies] = useState<ReadonlySet<string>>(() => new Set());
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
  const topics = useMemo(() => topicIndex(summary), [summary]);
  const topicOf = (itemId: string) => topics.get(itemId) ?? null;
  const topicTitleOf = (ordinal: number) =>
    summary?.topics.find((row) => row.ordinal === ordinal)?.title ?? "";
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
  // 항목이 나온 때는 인용한 스크립트 구간으로 계산한다(APP-865) — server 는 항목에 시각을 싣지 않는다.
  const starts = useMemo(() => segmentStarts(segments), [segments]);
  const citedAt = useCallback((item: ReviewItem) => citedAtOf(item, starts), [starts]);
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
  const gateItems = items.map((item) =>
    isSummaryKind(item.kind)
      ? item
      : {
          ...item,
          replacements: [],
          taskChanges: item.taskChanges.filter((row) =>
            unsavedApplies.has(`${item.itemId}:${row.target.itemId}`)
          ),
        }
  );
  const unnamedAssigned = items.filter(
    (item) =>
      item.included &&
      item.kind === "ACTION_ITEM" &&
      item.assignee?.type === "SPEAKER_LABEL"
  ).length;
  const editable = canEdit && !confirmed;

  // 제안의 선택은 검토본에 저장한다 — 새로고침하거나 다른 참석자가 열어도 같은 선택이 보인다.
  const choose = (
    item: ReviewItem,
    targetId: string,
    decision: "END" | "APPLIED" | "KEEP"
  ) => editor.updateItem(item.itemId, { decisions: [{ targetId, decision }] });
  const saving = editor.busyItemId !== null;
  const hasTask = (taskId: string) => tasksById.has(taskId);
  // **화면에 서는 항목의 제안만 본다.** 요약 보기에 없는 이슈 · 질문 · 참고의 제안은 고를 곳이 없어,
  // 세면 검토 완료가 영영 막힌다. 고르지 않은 제안은 확정이 건너뛴다 — 이전 결정을 끝내지 않고 할 일도
  // 바꾸지 않는다(그래프 보기에서 고르면 그 선택대로 된다).
  // 다만 할 일에 이미 반영한 변경은 감춘 항목이라도 선택이 저장될 때까지 센다 — 안 세면 할 일은 바뀌었는데
  // 제안은 고르지 않은 채 확정돼, 확정 뒤에는 선택을 다시 저장할 길도 없다.
  const unchosen = unchosenSuggestionCount(gateItems, hasTask);
  const blockInput = {
    saving,
    applyingTasks,
    hasTaskChanges: gateItems.some(
      (item) => item.included && item.taskChanges.length > 0
    ),
    tasks:
      !workspaceId || !projectId || tasksQuery.isPending
        ? ("pending" as const)
        : // 이미 읽은 할 일이 있으면 재조회가 실패해도 쓴다(APP-1033). 낡았어도 반영은 판 대조가 거절로 걸러내고,
          // 막으면 확정 막대가 재시도가 성공할 때까지 「불러오지 못했다」로 막힌다.
          tasks
          ? ("ready" as const)
          : ("failed" as const),
  };
  // 확정은 되돌릴 수 없다. 저장 · 반영이 끝나지 않았거나 고를 제안이 아직 안 섰으면 막고 까닭을 적는다.
  // 고를 제안이 남은 것보다 앞선 까닭이 있으면 그것을 먼저 말한다 — 막대가 그 까닭을 그대로 쓴다.
  const earlierBlock = confirmBlockReason({ ...blockInput, unchosen: 0 });
  const confirmBlocked = confirmBlockReason({ ...blockInput, unchosen });
  // 막대의 「제안으로 가기」가 데려갈 줄. 요약 보기에 선 줄만이다.
  const firstUnchosen = sections
    .flatMap((section) => section.items)
    .find((item) => unchosenSuggestionCount([item], hasTask) > 0);

  const toggleItem = (itemId: string) =>
    setOpenItemId((current) => (current === itemId ? null : itemId));

  const selectLinked = (itemId: string) => setOpenItemId(itemId);

  /**
   * 그 줄로 간다. 접힌 「N개 더」가 펼쳐지고 앞서 펼쳐 둔 줄이 접히는 높이 전환(`Collapse` 200ms)이
   * 끝난 뒤에 재야 자리가 맞다 — 전환 중에 재면 뒤쪽 줄은 펼침이 끝난 뒤 화면 밖에 남는다.
   */
  const scrollToItem = (itemId: string) => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    window.setTimeout(
      () =>
        document
          .querySelector(`[data-item-id="${CSS.escape(itemId)}"]`)
          ?.scrollIntoView?.({ block: "center", behavior: reduce ? "auto" : "smooth" }),
      reduce ? 0 : COLLAPSE_SETTLE_MS
    );
  };
  const showItem = (itemId: string) => {
    setOpenItemId(itemId);
    scrollToItem(itemId);
  };

  const suggestionsOf = (item: ReviewItem) =>
    item.replacements.length + item.taskChanges.length > 0 ? (
      <div className="space-y-1.5">
        {item.replacements.map((replacement) => (
          <ReplacementSuggestion
            key={replacement.target.itemId}
            replacement={replacement}
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
              task={tasksById.get(change.target.itemId)}
              workspaceId={workspaceId}
              projectId={projectId}
              choices={assigneeChoices}
              choice={choiceOf(change.decision)}
              taskState={
                tasksQuery.isPending ? "pending" : tasks ? "ready" : "failed"
              }
              onRetryTask={() => void tasksQuery.refetch()}
              disabled={!editable || saving || !item.included}
              onChoose={async (next) => {
                const saved = await choose(
                  item,
                  change.target.itemId,
                  next === "change" ? "APPLIED" : "KEEP"
                );
                // 「반영」의 선택 저장은 할 일을 바꾼 뒤에만 온다. 실패한 것만 남겨 두고 저장되면 지운다.
                if (next === "change") {
                  const key = `${item.itemId}:${change.target.itemId}`;
                  setUnsavedApplies((keys) => {
                    const nextKeys = new Set(keys);
                    if (saved) nextKeys.delete(key);
                    else nextKeys.add(key);
                    return nextKeys;
                  });
                }
                return saved;
              }}
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
      onSelectItem={selectLinked}
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
      setApproveError(errorMessageOf(error, "검토를 완료하지 못했습니다."));
      await queryClient.invalidateQueries({
        queryKey: getGetMeetingReviewQueryKey(noteId),
      });
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
    return atMs === null ? [] : [{ itemId: item.itemId, kind: item.kind, atMs, content: item.content }];
  });
  const isMine = (item: ReviewItem) =>
    Boolean(currentUserId) &&
    item.assignee?.type === "USER" &&
    item.assignee.id === currentUserId;

  return (
    <div className="flex min-h-full flex-col">
      <BoardShell>
        <ReviewHead
          meta={noteMeta}
          participants={participants}
          lengthMs={lengthMs}
          confirmed={confirmed}
          aside={
            <SegmentedControl
              label="보기"
              value={view}
              options={VIEWS}
              onChange={setView}
            />
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
                      : [{ ordinal: topic.ordinal, title: topic.title, startMs: topic.startMs }]
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
                <TopicIndex topics={digests} onOpenTimeline={onOpenTimeline} />
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
                    adding={editor.adding}
                    aside={
                      section.key === "ACTION_ITEM" && unnamedAssigned > 0 ? (
                        <>
                          <span>이름 없는 화자에게 걸린 할 일 {unnamedAssigned}</span>
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
              {summary?.status === "SUCCEEDED" && summary.lead.length > 0 ? (
                <p className="mb-5 max-w-[60ch] text-base leading-7 break-keep text-[var(--el-ink)]">
                  {summary.lead.map((line) => line.text).join(" ")}
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
                  className="aspect-[840/520] w-full rounded-block"
                />
              ) : (
                <ReviewGraph
                  summary={
                    summary ?? {
                      noteId,
                      status: "NOT_AVAILABLE",
                      resultVersion: null,
                      headline: null,
                      lead: [],
                      topics: [],
                    }
                  }
                  items={items}
                  selectedItemId={openItemId}
                  onSelect={setOpenItemId}
                />
              )}
              {selected ? (
                <div
                  key={selected.itemId}
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
                          summary?.topics.find(
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

      {editable ? (
        <ConfirmBar
          summary={confirmSummary}
          decisions={included.filter((item) => item.kind === "DECISION").length}
          pending={approve.isPending}
          blocked={confirmBlocked}
          unchosen={earlierBlock ? 0 : unchosen}
          onShowUnchosen={
            firstUnchosen && view === "summary"
              ? // 접힌 「N개 더」 안의 줄은 펼쳐야 DOM 에 선다 — 펼치고 간다.
                () => showItem(firstUnchosen.itemId)
              : undefined
          }
          error={approveError}
          raised={dockRaised}
          onConfirm={confirm}
        />
      ) : null}
    </div>
  );
}

/** 회의록 문서 한 단(APP-865). 시안의 760 칸에서 좌우 여백을 뺀 680 이 글 폭이다. */
function BoardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[calc(680px+2*var(--note-gutter))] flex-1 px-[var(--note-gutter)] pt-8 pb-10 sm:pt-10">
      {children}
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
            <Skeleton key={width} className="h-[26px] rounded-control" style={{ width }} />
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
