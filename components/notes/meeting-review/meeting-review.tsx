"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/auth-provider";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { getGetNoteQueryKey } from "@/lib/api/generated/notes/notes";
import {
  approveMeeting,
  createReviewItem,
  fetchMeetingApproval,
  fetchMeetingReview,
  judgeRelation,
  recheckRelations,
  updateReviewItem,
} from "@/lib/notes/meeting-review/api";
import {
  approvalRejectedSchema,
  reviewConflictSchema,
  type ApprovalRejected,
  type MeetingApproval,
} from "@/lib/notes/meeting-review/contract";
import {
  hasUnsavedEdits,
  initialEdits,
  reduceEdits,
  type EditKey,
  type ItemEdit,
  type RelationEdit,
} from "@/lib/notes/meeting-review/edits";
import {
  getConceptSummaryQueryKey,
  getMeetingApprovalQueryKey,
  getMeetingReviewQueryKey,
} from "@/lib/notes/meeting-review/query-keys";
import { needsPolling, toReviewScreen } from "@/lib/notes/meeting-review/select";

import { EvaluationPanel } from "./evaluation-panel";
import { RelationsPanel } from "./relations-panel";
import { ReviewGate } from "./review-gate";
import { ReviewRegions } from "./review-regions";

/**
 * 준비가 끝나기 전에만 도는 저주기 폴링. 계약에 준비 완료 신호가 없어서다 — noteTopic
 * 메시지가 생기면 이 값은 사라진다(`ADAPTER.md`).
 */
export const MEETING_REVIEW_POLL_MS = 4_000;

const TSID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 승인 요청의 멱등 키. 재시도는 같은 키를 쓴다 — server 가 기존 결과로 수렴시킨다. */
export function newIdempotencyKey() {
  const bytes = new Uint8Array(13);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => TSID_ALPHABET[byte % 32]).join("");
}

type NoteFromCache = {
  status: number;
  data: { success: boolean; data: { projectId: string; meetingStartedBy: { userId: string } | null } };
};

/**
 * 검토·확정 화면의 소유자. 조회·폴링·mutation·편집 상태가 여기 있고 네 영역은 props 만 받는다.
 *
 * 노트는 다시 구독하지 않는다 — 셸이 이미 읽었으므로 캐시에서 `meetingStartedBy` 와
 * `projectId` 만 꺼낸다(`note-realtime-provider` 와 같은 방식).
 */
export function MeetingReview({
  noteId,
  onEvidenceSelect,
  onItemsReady,
}: {
  noteId: string;
  onEvidenceSelect: (segmentId: string) => void;
  /**
   * 회의 결과 영역이 기다림을 벗어났는가. 부모가 「이전 분석」의 접힘을 정하는 데 쓴다 —
   * 명제가 준비되기 전에는 실제로 도는 구식 분석의 진행 표시를 가리지 않는다.
   */
  onItemsReady?: (ready: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const note = (queryClient.getQueryData(getGetNoteQueryKey(noteId)) as NoteFromCache | undefined)
    ?.data.data;
  const isStarter = Boolean(user && note?.meetingStartedBy?.userId === user.userId);

  const reviewQuery = useQuery({
    queryKey: getMeetingReviewQueryKey(noteId),
    queryFn: () => fetchMeetingReview(noteId),
    retry: false,
    refetchInterval: (query) =>
      query.state.data && needsPolling(query.state.data.readiness) ? MEETING_REVIEW_POLL_MS : false,
  });
  const review = reviewQuery.data;

  const approvalQuery = useQuery({
    queryKey: getMeetingApprovalQueryKey(noteId),
    queryFn: () => fetchMeetingApproval(noteId),
    enabled: Boolean(review?.approved),
    retry: false,
  });

  const [edits, dispatch] = useReducer(reduceEdits, 0, initialEdits);
  useEffect(() => {
    if (review) dispatch({ type: "sync-version", reviewVersion: review.reviewVersion });
  }, [review]);
  const itemsStatus = review?.readiness.items;
  useEffect(() => {
    if (!itemsStatus) return;
    onItemsReady?.(itemsStatus !== "NOT_READY" && itemsStatus !== "GENERATING");
  }, [itemsStatus, onItemsReady]);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [rejected, setRejected] = useState<ApprovalRejected | null>(null);

  const invalidateReview = useCallback(
    () => queryClient.invalidateQueries({ queryKey: getMeetingReviewQueryKey(noteId) }),
    [queryClient, noteId]
  );

  /** 저장 실패를 갈라 reducer 로 보낸다. 409 는 충돌, 나머지는 문구. */
  const settleFailure = useCallback(
    (key: EditKey, error: unknown, local: ItemEdit | RelationEdit) => {
      const envelope = (error as { error?: unknown } | null)?.error;
      const conflict = reviewConflictSchema.safeParse(envelope);
      if (conflict.success) {
        const { current, currentReviewVersion = null } = conflict.data;
        if (key.startsWith("item:") && current?.item) {
          dispatch({
            type: "conflict",
            key,
            conflict: { kind: "item", local: local as ItemEdit, server: current.item, currentReviewVersion },
          });
          return;
        }
        if (key.startsWith("relation:") && current?.relation) {
          dispatch({
            type: "conflict",
            key,
            conflict: {
              kind: "relation",
              local: local as RelationEdit,
              server: current.relation,
              currentReviewVersion,
            },
          });
          return;
        }
        // 항목 자체가 아니라 검토본 버전이 어긋났다. 다시 읽고 편집은 남긴다.
        dispatch({ type: "failed", key, message: conflict.data.message });
        void invalidateReview();
        return;
      }
      dispatch({ type: "failed", key, message: errorMessageOf(error, "잠시 뒤 다시 시도해 주세요.") });
    },
    [invalidateReview]
  );

  // 인라인으로 그리므로 전역 토스트는 끈다(`error-loading.md`).
  const saveItem = useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: async ({ itemId, edit }: { itemId: string; edit: ItemEdit }) => {
      const item = review?.items.find((candidate) => candidate.itemId === itemId);
      if (!item) throw new Error("항목을 찾을 수 없습니다.");
      return updateReviewItem(noteId, itemId, {
        expectedReviewVersion: edits.reviewVersion,
        expectedItemRevision: item.revision,
        ...edit,
      });
    },
  });

  const saveRelation = useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: async ({ relationId, edit }: { relationId: string; edit: RelationEdit }) => {
      const relation = review?.relations.find((candidate) => candidate.relationId === relationId);
      if (!relation) throw new Error("관계를 찾을 수 없습니다.");
      return judgeRelation(noteId, relationId, {
        expectedReviewVersion: edits.reviewVersion,
        expectedRelationRevision: relation.revision,
        ...edit,
      });
    },
  });

  const addItem = useMutation({
    mutationFn: (input: { regionId?: string; kind: string; content: string }) =>
      createReviewItem(noteId, { expectedReviewVersion: edits.reviewVersion, ...input }),
    onSuccess: (result) => {
      dispatch({ type: "sync-version", reviewVersion: result.reviewVersion });
      void invalidateReview();
    },
  });

  const recheck = useMutation({
    mutationFn: () => recheckRelations(noteId, edits.reviewVersion),
    onSuccess: () => void invalidateReview(),
  });

  const idempotencyKeyRef = useRef<string | null>(null);
  const approve = useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: async () => {
      if (!review) throw new Error("검토본이 없습니다.");
      idempotencyKeyRef.current ??= newIdempotencyKey();
      return approveMeeting(noteId, {
        idempotencyKey: idempotencyKeyRef.current,
        reviewVersion: edits.reviewVersion,
        projectApprovalVersion: review.projectApprovalVersion,
      });
    },
    onSuccess: (approval: MeetingApproval) => {
      idempotencyKeyRef.current = null;
      setRejected(null);
      queryClient.setQueryData(getMeetingApprovalQueryKey(noteId), approval);
      void invalidateReview();
      if (note?.projectId) {
        void queryClient.invalidateQueries({ queryKey: getConceptSummaryQueryKey(note.projectId) });
      }
    },
    onError: (error) => {
      const parsed = approvalRejectedSchema.safeParse((error as { error?: unknown } | null)?.error);
      if (parsed.success) {
        setRejected(parsed.data);
        // 서버가 준 게이트·버전으로 화면을 맞춘다. 검토본은 건드리지 않는다.
        void invalidateReview();
      } else {
        setRejected({
          code: "REVIEW_VERSION_CONFLICT",
          message: errorMessageOf(error, errorCodeOf(error) ?? "승인하지 못했습니다."),
        });
      }
    },
  });

  /** 편집 완료 단위로 저장한다. 성공이면 서버 값으로 수렴하고 실패면 편집을 남긴다. */
  const commitItem = useCallback(
    async (itemId: string, edit: ItemEdit) => {
      const key: EditKey = `item:${itemId}`;
      dispatch({ type: "saving", key });
      try {
        const result = await saveItem.mutateAsync({ itemId, edit });
        dispatch({ type: "saved", key, reviewVersion: result.reviewVersion });
        void invalidateReview();
      } catch (error) {
        settleFailure(key, error, edit);
      }
    },
    [saveItem, invalidateReview, settleFailure]
  );

  const commitRelation = useCallback(
    async (relationId: string, edit: RelationEdit) => {
      const key: EditKey = `relation:${relationId}`;
      dispatch({ type: "edit-relation", relationId, edit });
      dispatch({ type: "saving", key });
      try {
        const result = await saveRelation.mutateAsync({ relationId, edit });
        dispatch({ type: "saved", key, reviewVersion: result.reviewVersion });
        void invalidateReview();
      } catch (error) {
        settleFailure(key, error, edit);
      }
    },
    [saveRelation, invalidateReview, settleFailure]
  );

  // 항목 카드는 `onEdit` 로 편집을 쌓고 `onCommit` 으로 저장을 요청한다. 쌓인 편집을 여기서 읽는다.
  const pendingRef = useRef(edits.pendingItems);
  useEffect(() => {
    pendingRef.current = edits.pendingItems;
  }, [edits.pendingItems]);
  const onEditItem = useCallback((itemId: string, edit: ItemEdit) => {
    dispatch({ type: "edit-item", itemId, edit });
    pendingRef.current = { ...pendingRef.current, [itemId]: { ...pendingRef.current[itemId], ...edit } };
  }, []);
  const onCommitItem = useCallback(
    (itemId: string) => {
      const edit = pendingRef.current[itemId];
      if (edit) void commitItem(itemId, edit);
    },
    [commitItem]
  );

  /** 승인 전 미저장 편집을 전부 저장하고, 하나라도 실패하면 승인하지 않는다. */
  const onApprove = useCallback(async () => {
    setRejected(null);
    const pending = Object.entries(pendingRef.current);
    if (pending.length > 0) {
      await Promise.all(pending.map(([itemId, edit]) => commitItem(itemId, edit)));
      if (hasUnsavedEdits(edits) || Object.keys(pendingRef.current).length > 0) return;
    }
    approve.mutate();
  }, [approve, commitItem, edits]);

  const jumpTo = useCallback((target: { itemId?: string; relationId?: string }) => {
    if (target.itemId) setSelectedItemId(target.itemId);
    const selector = target.itemId
      ? `[data-item-id="${target.itemId}"]`
      : `[data-relation-id="${target.relationId}"]`;
    document.querySelector(selector)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  if (reviewQuery.isLoading) {
    return <ReviewSkeleton />;
  }
  if (!review) {
    // 권한 없음(403)은 항목·근거를 싣지 않는다. 빈 자리에 사유만 남긴다.
    if (errorCodeOf(reviewQuery.error) === "FORBIDDEN" || errorCodeOf(reviewQuery.error) === "NOT_MEETING_PARTICIPANT") {
      return (
        <p role="alert" className="text-[13px] text-[var(--el-muted)]">
          이 회의의 검토본을 볼 권한이 없습니다.
        </p>
      );
    }
    return <InlineRetry onRetry={() => void reviewQuery.refetch()} label="검토본을 불러오지 못했습니다" />;
  }

  const screen = toReviewScreen(review);
  const canEdit = isStarter && !review.approved;
  const unsavedCount =
    Object.keys(edits.pendingItems).length +
    Object.keys(edits.pendingRelations).length +
    Object.keys(edits.conflicts).length;

  const itemActions = {
    onSelect: setSelectedItemId,
    onEdit: onEditItem,
    onCommit: onCommitItem,
    onKeepLocal: (itemId: string) => dispatch({ type: "keep-local", key: `item:${itemId}` }),
    onTakeServer: (itemId: string) => {
      dispatch({ type: "take-server", key: `item:${itemId}` });
      void invalidateReview();
    },
    onEvidenceSelect,
  };

  return (
    <div data-testid="meeting-review" className="space-y-8">
      <ReviewGate
        screen={screen}
        isStarter={isStarter}
        unsavedCount={unsavedCount}
        approving={approve.isPending}
        rejected={rejected}
        approval={review.approved ? (approvalQuery.data ?? null) : null}
        onApprove={() => void onApprove()}
        onJumpTo={jumpTo}
      />
      <ReviewRegions
        screen={screen}
        edits={edits}
        selectedItemId={selectedItemId}
        canEdit={canEdit}
        onAddItem={(regionId, kind, content) => addItem.mutate({ regionId, kind, content })}
        actions={itemActions}
      />
      <EvaluationPanel
        evaluation={screen.evaluation}
        onEvidenceSelect={onEvidenceSelect}
        onSelectItem={(itemId) => jumpTo({ itemId })}
      />
      <RelationsPanel
        screen={screen}
        edits={edits}
        selectedItemId={selectedItemId}
        canEdit={canEdit}
        onSelectItem={(itemId) => jumpTo({ itemId })}
        onJudge={(relationId, edit) => void commitRelation(relationId, edit)}
        onKeepLocal={(relationId) => dispatch({ type: "keep-local", key: `relation:${relationId}` })}
        onTakeServer={(relationId) => {
          dispatch({ type: "take-server", key: `relation:${relationId}` });
          void invalidateReview();
        }}
        onRecheck={() => recheck.mutate()}
        recheckPending={recheck.isPending}
        onEvidenceSelect={onEvidenceSelect}
      />
    </div>
  );
}

/** 검토본 조회 skeleton. 게이트 상자 + 영역 머리글 셋 + 항목 줄. 머리글은 가리지 않는다. */
function ReviewSkeleton() {
  return (
    <div aria-label="검토본을 불러오는 중" className="space-y-8">
      <div className="space-y-3 rounded-[12px] border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-4">
        <h3 className="text-[15px] font-semibold text-[var(--el-ink)]">검토·확정</h3>
        <Skeleton className="h-4 w-[60%]" />
        <Skeleton className="h-9 w-[132px]" />
      </div>
      {["회의 결과", "회의 평가", "명제 연결"].map((title) => (
        <section key={title} className="space-y-3">
          <h3 className="border-b border-[var(--el-hairline)] pb-2 text-[15px] font-semibold text-[var(--el-ink)]">
            {title}
          </h3>
          <Skeleton className="h-[66px] w-full rounded-[12px]" />
          <Skeleton className="h-[66px] w-[88%] rounded-[12px]" />
        </section>
      ))}
    </div>
  );
}
