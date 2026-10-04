"use client";

import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { SegmentedControl } from "@/components/heymoa/segmented-control";
import { ConfirmBar } from "@/components/notes/review/confirm-bar";
import { ItemDetail } from "@/components/notes/review/item-detail";
import { ItemTrail } from "@/components/notes/review/item-trail";
import { ReviewGraph } from "@/components/notes/review/review-graph";
import { ReviewOverview } from "@/components/notes/review/review-overview";
import { ReviewSection } from "@/components/notes/review/review-section";
import { TopicIndex, TopicScope } from "@/components/notes/review/topic-index";
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
import {
  choiceOf,
  confirmBlockReason,
  confirmSummaryOf,
  unchosenSuggestionCount,
} from "@/lib/notes/review/confirm";
import { moveFlowStatus } from "@/lib/notes/review/flow-cache";
import { isProjectTaskQueryKey } from "@/lib/tasks/task-groups";
import {
  KIND_LABEL,
  REVIEW_SECTIONS,
  isSummaryKind,
  isSummarySection,
  sectionsOf,
  type ReviewItem,
  type ReviewSection as ReviewSectionData,
} from "@/lib/notes/review/sections";
import {
  topicChips,
  topicIndex,
  topicNumber,
} from "@/lib/notes/review/topics";
import { useReviewEditor } from "@/lib/notes/review/use-review-editor";
import {
  createSpeakerIdentityResolver,
  type SpeakerFace,
} from "@/lib/transcription/speaker-identity";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";

type View = "summary" | "graph";

const VIEWS = [
  { value: "summary", label: "요약" },
  { value: "graph", label: "그래프" },
] as const;

const TSID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

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
  participants,
  onOpenScript,
  onOpenTranscript,
}: {
  noteId: string;
  workspaceId: string | undefined;
  projectId: string | undefined;
  confirmed: boolean;
  canEdit: boolean;
  participants: SpeakerFace[];
  onOpenScript: (segmentId: string) => void;
  onOpenTranscript: () => void;
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
  const [topic, setTopic] = useState<number | null>(null);
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
  // 요약 보기는 결정 · 할 일만 세운다(APP-864). 이슈 · 질문 · 참고는 그래프 보기에만 선다.
  // 목차의 수도 그 항목만 센다 — 그 주제로 좁혔을 때 보이는 수와 같아야 한다.
  const topicEntries = useMemo(
    () =>
      topicChips(summary, items, (itemId) => {
        const item = itemsById.get(itemId);
        return !item || isSummaryKind(item.kind);
      }),
    [summary, items, itemsById]
  );
  const topicTitleOf = (ordinal: number) =>
    topicEntries.find((entry) => entry.ordinal === ordinal)?.title ?? "";
  const selectedTopic =
    topicEntries.find((entry) => entry.ordinal === topic) ?? null;
  const sections = sectionsOf(items, topicOf, topic).filter((section) =>
    isSummarySection(section.key)
  );
  const tasksById = useMemo(
    () => new Map((tasks ?? []).map((task) => [task.taskId, task])),
    [tasks]
  );
  const segments = useMemo(() => transcript?.segments ?? [], [transcript]);
  const speakers = transcript?.diarization.speakers;

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
  const summaryItems = items.filter((item) => isSummaryKind(item.kind));
  const includedCount = summaryItems.filter((item) => item.included).length;
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
  // 확정은 되돌릴 수 없다. 저장 · 반영이 끝나지 않았거나 고를 제안이 아직 안 섰으면 막고 까닭을 적는다.
  const confirmBlocked = confirmBlockReason({
    saving,
    applyingTasks,
    // **화면에 서는 항목의 제안만 본다.** 요약 보기에 없는 이슈 · 질문 · 참고의 제안은 고를 곳이 없어,
    // 세면 검토 완료가 영영 막힌다. 고르지 않은 제안은 확정이 건너뛴다 — 이전 결정을 끝내지 않고 할 일도
    // 바꾸지 않는다(그래프 보기에서 고르면 그 선택대로 된다).
    // 다만 할 일에 이미 반영한 변경은 감춘 항목이라도 선택이 저장될 때까지 센다 — 안 세면 할 일은 바뀌었는데
    // 제안은 고르지 않은 채 확정돼, 확정 뒤에는 선택을 다시 저장할 길도 없다.
    hasTaskChanges: gateItems.some(
      (item) => item.included && item.taskChanges.length > 0
    ),
    unchosen: unchosenSuggestionCount(gateItems, (taskId) => tasksById.has(taskId)),
    tasks:
      !workspaceId || !projectId || tasksQuery.isPending
        ? "pending"
        : tasks && !tasksQuery.isError
          ? "ready"
          : "failed",
  });

  const toggleItem = (itemId: string) =>
    setOpenItemId((current) => (current === itemId ? null : itemId));

  const selectLinked = (itemId: string) => {
    setTopic(null);
    setOpenItemId(itemId);
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

  const summaryItemsById = new Map(summaryItems.map((item) => [item.itemId, item]));
  // 요약 보기의 줄은 제안을 줄 아래에 늘 세우므로 펼친 속에는 수정 기록만 둔다. 그래프의 상세 패널은 제안까지 품는다.
  const detailOf = (item: ReviewItem, inPanel = false) => (
    <ItemDetail
      item={item}
      summary={summary}
      // 요약 보기의 줄은 거기 서는 항목으로만 잇는다 — 없는 항목으로 이으면 눌러도 열 자리가 없다.
      itemsById={inPanel ? itemsById : summaryItemsById}
      onSelectItem={selectLinked}
      suggestions={inPanel ? suggestionsOf(item) : null}
      elevated={!inPanel}
      trail={
        <ItemTrail
          noteId={noteId}
          item={item}
          segments={segments}
          scriptState={
            transcriptQuery.isPending
              ? "pending"
              : transcript
                ? "ready"
                : "failed"
          }
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

  return (
    <div className="flex min-h-full flex-col">
      <BoardShell>
        <div className="flex flex-wrap items-center gap-3 pb-5">
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-chip px-2 text-[11px] font-semibold transition-colors duration-200 ease-out",
              confirmed
                ? "bg-[var(--el-success)]/10 text-[var(--el-success-strong)]"
                : "bg-[var(--el-surface-strong)] text-[var(--el-ink)]"
            )}
          >
            {confirmed ? "확정됨" : "검토 중"}
          </span>
          <span className="text-xs text-[var(--el-muted)]">
            항목 {includedCount}개
            {summary?.topics.length ? ` · 주제 ${summary.topics.length}개` : ""}
          </span>
          <SegmentedControl
            label="보기"
            className="ml-auto"
            value={view}
            options={VIEWS}
            onChange={setView}
          />
        </div>

        <SpeakerNudgeBanner noteId={noteId} />
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
              <ReviewOverview
                summary={summary}
                pending={summaryQuery.isPending}
                failed={summaryQuery.isError}
                onRetry={() => void summaryQuery.refetch()}
              />
              <TopicIndex
                topics={topicEntries}
                topic={topic}
                onTopicChange={setTopic}
              />
              {(() => {
                const sectionOf = (section: ReviewSectionData) => (
                  <ReviewSection
                    // 주제를 바꾸면 쓰던 추가 폼도 닫는다. 제출 시점의 주제로 저장되므로 글이 다른 주제에 새면 안 된다.
                    key={`${section.key}:${selectedTopic?.ordinal ?? "all"}`}
                    section={section}
                    topicOf={topicOf}
                    topicTitleOf={topicTitleOf}
                    topicTitle={selectedTopic?.title ?? null}
                    canEdit={editable}
                    choices={assigneeChoices}
                    openItemId={openItemId}
                    busyItemId={editor.busyItemId}
                    conflictItemId={editor.conflictItemId}
                    adding={editor.adding}
                    hint={
                      editable &&
                      section.key === "ACTION_ITEM" &&
                      section.items.length > 0
                        ? "담당과 기한은 칸을 눌러 바로 고칩니다"
                        : undefined
                    }
                    aside={
                      section.key === "ACTION_ITEM" &&
                      unnamedAssigned > 0 ? (
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
                      editor.addItem({
                        kind,
                        content,
                        citations: [],
                        // 전체 보기에서는 키 자체를 싣지 않는다.
                        ...(selectedTopic && { topicOrdinal: selectedTopic.ordinal }),
                      })
                    }
                    onDismissConflict={editor.dismissConflict}
                    renderDetail={detailOf}
                    suggestionsOf={suggestionsOf}
                  />
                );
                const list = (
                  <>
                    {sections.map(sectionOf)}
                  </>
                );
                return selectedTopic ? (
                  <TopicScope
                    entry={selectedTopic}
                    onClear={() => setTopic(null)}
                  >
                    {list}
                  </TopicScope>
                ) : (
                  list
                );
              })()}
            </>
          ) : (
            <div>
              {summary?.status === "SUCCEEDED" && summary.lead.length > 0 ? (
                <p className="mb-5 max-w-[60ch] text-base leading-7 break-keep text-[var(--el-ink)]">
                  {summary.lead.map((line) => line.text).join(" ")}
                </p>
              ) : null}
              {/* 조회가 실패했는데 「주제 묶음이 없다」고 말하면 없는 것처럼 읽힌다 */}
              {summaryQuery.isError ? (
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
                  <div className="p-3">{detailOf(selected, true)}</div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </BoardShell>

      {editable ? (
        <ConfirmBar
          summary={confirmSummary}
          pending={approve.isPending}
          blocked={confirmBlocked}
          error={approveError}
          onConfirm={confirm}
        />
      ) : null}
    </div>
  );
}

function BoardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] flex-1 px-[var(--note-gutter)] pt-6 pb-10">
      {children}
    </div>
  );
}

/** 검토본 조회 skeleton. 섹션 제목은 고정이라 가리지 않고 줄만 막대로 둔다. */
export function ReviewBoardSkeleton() {
  return (
    <BoardShell>
      <div aria-label="검토본 불러오는 중">
        <div className="flex items-center gap-3 pb-5">
          <Skeleton className="h-5 w-12 rounded-chip" />
          <Skeleton className="h-4 w-28 rounded-chip" />
          <Skeleton className="ml-auto h-8 w-[120px] rounded-full" />
        </div>
        <ReviewOverview summary={null} pending />
        {REVIEW_SECTIONS.slice(0, 2).map((section) => (
          <SectionBlock key={section.key} title={section.label}>
            {["78%", "64%", "71%"].map((width) => (
              <div
                key={width}
                className="flex h-10 items-center border-b border-[var(--el-hairline-soft)]"
              >
                <Skeleton className="h-4 rounded-chip" style={{ width }} />
              </div>
            ))}
          </SectionBlock>
        ))}
      </div>
    </BoardShell>
  );
}
