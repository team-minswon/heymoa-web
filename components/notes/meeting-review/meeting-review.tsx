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
  type ApprovalGate,
  type MeetingApproval,
  type ReviewItem,
  type ReviewRelation,
} from "@/lib/notes/meeting-review/contract";
import {
  clearEdits,
  loadEdits,
  settleStoredEdits,
  storeEdits,
  subscribeEdits,
} from "@/lib/notes/meeting-review/edits-store";
import {
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
import { ReviewGate, type ApprovalFailure } from "./review-gate";
import { ReviewRegions } from "./review-regions";

/**
 * 준비가 끝나기 전에만 도는 저주기 폴링. 계약에 준비 완료 신호가 없어서다 — noteTopic
 * 메시지가 생기면 이 값은 사라진다(`ADAPTER.md`).
 */
export const MEETING_REVIEW_POLL_MS = 4_000;
/**
 * 준비가 끝난 뒤에도 승인 전까지는 저주기로 다시 읽는다 — 다른 창의 편집·승인이 이 화면에
 * 닿는 경로가 이것뿐이다(전역이 `refetchOnWindowFocus: false` 이고 noteTopic 에 검토 이벤트가 없다).
 * 승인되면 검토본은 더 안 자라므로 멈춘다. 노트 조회의 안전 폴링과 같은 무늬다.
 */
export const MEETING_REVIEW_SAFETY_POLL_MS = 30_000;

const TSID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 승인 요청의 멱등 키. 재시도는 같은 키를 쓴다 — server 가 기존 결과로 수렴시킨다. */
export function newIdempotencyKey() {
  const bytes = new Uint8Array(13);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => TSID_ALPHABET[byte % 32]).join("");
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
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
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      if (needsPolling(data.readiness)) return MEETING_REVIEW_POLL_MS;
      return data.approved ? false : MEETING_REVIEW_SAFETY_POLL_MS;
    },
  });
  const review = reviewQuery.data;

  const approvalQuery = useQuery({
    queryKey: getMeetingApprovalQueryKey(noteId),
    queryFn: () => fetchMeetingApproval(noteId),
    enabled: Boolean(review?.approved),
    retry: false,
  });

  // 탭을 옮겨 언마운트돼도 되찾는다 — 근거를 보러 갔다 오는 것은 검토의 일부다.
  const [edits, dispatch] = useReducer(reduceEdits, noteId, (id) => loadEdits(id) ?? initialEdits(0));
  useEffect(() => {
    storeEdits(noteId, edits);
  }, [noteId, edits]);
  useEffect(() => {
    // 언마운트 중 끝난 저장이 보관소에 먼저 닿는다. 되돌아온 화면은 그 완료를 여기서 받는다.
    return subscribeEdits(noteId, (state) => dispatch({ type: "replace", state }));
  }, [noteId]);
  /**
   * 저장의 CAS 에 실을 검토본 버전. reducer 의 값과 같지만 **동기로** 앞선다 — 연속 저장이
   * 한 렌더 안에서 이어질 때 클로저의 옛 버전을 다시 보내지 않기 위해서다.
   */
  const versionRef = useRef(0);
  const bumpVersion = useCallback((reviewVersion: number | null | undefined) => {
    if (typeof reviewVersion === "number" && reviewVersion > versionRef.current) {
      versionRef.current = reviewVersion;
    }
  }, []);
  useEffect(() => {
    if (review) {
      bumpVersion(review.reviewVersion);
      dispatch({ type: "sync-version", reviewVersion: review.reviewVersion });
    }
  }, [review, bumpVersion]);
  const approvedVersion = review?.approved?.approvalVersion ?? null;
  useEffect(() => {
    // 승인됐으면(이 창이든 다른 창이든) 미저장 편집을 확정 내용과 섞지 않는다. 보관소도 비운다.
    if (approvedVersion === null) return;
    clearEdits(noteId);
    dispatch({ type: "reset", reviewVersion: versionRef.current });
  }, [noteId, approvedVersion]);
  /**
   * 검토본 하나의 저장은 **직렬**이다. 두 요청이 같은 `expectedReviewVersion` 으로 나가면
   * 둘째는 반드시 충돌하므로, 앞 응답의 버전을 받은 뒤에 다음을 보낸다.
   */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(run: () => Promise<T>): Promise<T> => {
    const next = queueRef.current.then(run, run);
    queueRef.current = next.catch(() => undefined);
    return next;
  }, []);
  /** 편집·충돌·저장 중 상태의 최신 거울. 승인 클릭처럼 렌더 뒤 이벤트에서 읽는다. */
  const editsRef = useRef(edits);
  useEffect(() => {
    editsRef.current = edits;
  }, [edits]);
  const reviewKey = getMeetingReviewQueryKey(noteId);
  const latestItem = useCallback(
    (itemId: string) =>
      (queryClient.getQueryData(reviewKey) as typeof review)?.items.find(
        (candidate) => candidate.itemId === itemId
      ),
    [queryClient, reviewKey]
  );
  const latestRelation = useCallback(
    (relationId: string) =>
      (queryClient.getQueryData(reviewKey) as typeof review)?.relations.find(
        (candidate) => candidate.relationId === relationId
      ),
    [queryClient, reviewKey]
  );
  const itemsStatus = review?.readiness.items;
  useEffect(() => {
    if (!itemsStatus) return;
    onItemsReady?.(itemsStatus !== "NOT_READY" && itemsStatus !== "GENERATING");
  }, [itemsStatus, onItemsReady]);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [rejected, setRejected] = useState<ApprovalFailure | null>(null);

  const invalidateReview = useCallback(
    () => queryClient.invalidateQueries({ queryKey: getMeetingReviewQueryKey(noteId) }),
    [queryClient, noteId]
  );

  /** 저장 응답(항목·관계·게이트·버전)을 캐시에 겹쳐 쓴다. 재조회는 그 뒤에 수렴시킨다. */
  const applyMutation = useCallback(
    (result: { reviewVersion: number; item?: ReviewItem; relation?: ReviewRelation; approval?: ApprovalGate }) => {
      queryClient.setQueryData(reviewKey, (old: typeof review) =>
        // 재조회가 더 새 검토본을 먼저 받았으면 늦은 저장 응답의 본문은 버린다 — 버전만 지킨다.
        old && result.reviewVersion >= old.reviewVersion
          ? {
              ...old,
              reviewVersion: Math.max(old.reviewVersion, result.reviewVersion),
              items: result.item
                ? old.items.map((entry) => (entry.itemId === result.item!.itemId ? result.item! : entry))
                : old.items,
              relations: result.relation
                ? old.relations.map((entry) =>
                    entry.relationId === result.relation!.relationId ? result.relation! : entry
                  )
                : old.relations,
              approval: result.approval ?? old.approval,
            }
          : old
      );
    },
    [queryClient, reviewKey]
  );

  /** 저장 실패를 갈라 reducer 로 보낸다. 409 는 충돌, 나머지는 문구. */
  const settleFailure = useCallback(
    (key: EditKey, error: unknown, local: ItemEdit | RelationEdit) => {
      const envelope = (error as { error?: unknown } | null)?.error;
      const conflict = reviewConflictSchema.safeParse(envelope);
      if (conflict.success) {
        const { current, currentReviewVersion = null } = conflict.data;
        bumpVersion(currentReviewVersion);
        // 서버의 현재 값을 캐시에 반영한다 — 「내 편집 유지」 뒤의 재시도가 새 revision 으로 나간다.
        queryClient.setQueryData(reviewKey, (old: typeof review) =>
          old && (currentReviewVersion ?? 0) >= old.reviewVersion
            ? {
                ...old,
                reviewVersion: Math.max(old.reviewVersion, currentReviewVersion ?? 0),
                items: current?.item
                  ? old.items.map((entry) => (entry.itemId === current.item!.itemId ? current.item! : entry))
                  : old.items,
                relations: current?.relation
                  ? old.relations.map((entry) =>
                      entry.relationId === current.relation!.relationId ? current.relation! : entry
                    )
                  : old.relations,
              }
            : old
        );
        if (key.startsWith("item:") && current?.item) {
          const action = {
            type: "conflict" as const,
            key,
            conflict: { kind: "item" as const, local: local as ItemEdit, server: current.item, currentReviewVersion },
          };
          dispatch(action);
          settleStoredEdits(noteId, action);
          return;
        }
        if (key.startsWith("relation:") && current?.relation) {
          const action = {
            type: "conflict" as const,
            key,
            conflict: {
              kind: "relation" as const,
              local: local as RelationEdit,
              server: current.relation,
              currentReviewVersion,
            },
          };
          dispatch(action);
          settleStoredEdits(noteId, action);
          return;
        }
        // 항목 자체가 아니라 검토본 버전이 어긋났다. 다시 읽고 편집은 남긴다.
        const failed = { type: "failed" as const, key, message: conflict.data.message };
        dispatch(failed);
        settleStoredEdits(noteId, failed);
        void invalidateReview();
        return;
      }
      const failed = {
        type: "failed" as const,
        key,
        message: errorMessageOf(error, "잠시 뒤 다시 시도해 주세요."),
      };
      dispatch(failed);
      settleStoredEdits(noteId, failed);
    },
    [invalidateReview, bumpVersion, queryClient, reviewKey, noteId]
  );

  // 인라인으로 그리므로 전역 토스트는 끈다(`error-loading.md`).
  const saveItem = useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: async ({ itemId, edit }: { itemId: string; edit: ItemEdit }) => {
      const item = latestItem(itemId);
      if (!item) throw new Error("항목을 찾을 수 없습니다.");
      const { baseRevision, ...fields } = edit;
      return updateReviewItem(noteId, itemId, {
        expectedReviewVersion: versionRef.current,
        // 편집을 시작한 시점의 revision 이 있으면 그것이 기준이다. 없으면(검토 완료·제외) 최신.
        expectedItemRevision: baseRevision ?? item.revision,
        ...fields,
      });
    },
  });

  const saveRelation = useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: async ({ relationId, edit }: { relationId: string; edit: RelationEdit }) => {
      const relation = latestRelation(relationId);
      if (!relation) throw new Error("관계를 찾을 수 없습니다.");
      const { baseRevision, ...fields } = edit;
      return judgeRelation(noteId, relationId, {
        expectedReviewVersion: versionRef.current,
        expectedRelationRevision: baseRevision ?? relation.revision,
        ...fields,
      });
    },
  });

  const addItem = useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: (input: { regionId?: string; kind: string; content: string }) =>
      createReviewItem(noteId, { expectedReviewVersion: versionRef.current, ...input }),
    onSuccess: (result, variables) => {
      bumpVersion(result.reviewVersion);
      dispatch({ type: "sync-version", reviewVersion: result.reviewVersion });
      // 생성된 항목을 먼저 캐시에 넣고 영역에 잇는다 — 재조회가 실패해도 화면에 남는다.
      queryClient.setQueryData(reviewKey, (old: typeof review) => {
        if (!old || !result.item || result.reviewVersion < old.reviewVersion) return old;
        const item = result.item;
        return {
          ...old,
          reviewVersion: result.reviewVersion,
          items: old.items.some((entry) => entry.itemId === item.itemId)
            ? old.items
            : [...old.items, item],
          regions: old.regions.map((region) =>
            region.regionId === variables.regionId && !region.itemIds.includes(item.itemId)
              ? { ...region, itemIds: [...region.itemIds, item.itemId] }
              : region
          ),
          approval: result.approval ?? old.approval,
        };
      });
      void invalidateReview();
    },
    onError: () => void invalidateReview(),
  });
  /** 성공 여부를 돌려준다 — 폼은 성공했을 때만 비운다. */
  const onAddItem = useCallback(
    async (regionId: string | undefined, kind: string, content: string) => {
      try {
        await enqueue(() => addItem.mutateAsync({ regionId, kind, content }));
        return { ok: true as const };
      } catch (error) {
        return { ok: false as const, message: errorMessageOf(error, "항목을 추가하지 못했습니다.") };
      }
    },
    [addItem, enqueue]
  );

  const recheck = useMutation({
    mutationFn: () => recheckRelations(noteId, versionRef.current),
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
        reviewVersion: versionRef.current,
        projectApprovalVersion: review.projectApprovalVersion,
      });
    },
    onSuccess: (approval: MeetingApproval) => {
      idempotencyKeyRef.current = null;
      setRejected(null);
      queryClient.setQueryData(getMeetingApprovalQueryKey(noteId), approval);
      // 승인 메타를 검토본 캐시에 먼저 쓴다 — 이어지는 재조회가 실패해도 화면이 미승인으로 돌아가지 않는다.
      queryClient.setQueryData(reviewKey, (old: typeof review) =>
        old
          ? {
              ...old,
              approved: {
                approvalVersion: approval.approvalVersion,
                approvedAt: approval.approvedAt,
                approvedBy: approval.approvedBy,
              },
              projectApprovalVersion: approval.approvalVersion,
            }
          : old
      );
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
        // 계약 밖 실패(네트워크·500)는 충돌로 위장하지 않고 서버 문구 그대로 보여 준다.
        setRejected({
          code: "REQUEST_FAILED",
          message: errorMessageOf(error, errorCodeOf(error) ?? "승인하지 못했습니다."),
        });
      }
    },
  });

  // 항목 카드는 `onEdit` 로 편집을 쌓고 `onCommit` 으로 저장을 요청한다. 쌓인 편집을 여기서 읽는다.
  const pendingRef = useRef<Record<string, ItemEdit>>({});
  useEffect(() => {
    pendingRef.current = { ...edits.pendingItems };
  }, [edits.pendingItems]);
  /** 관계 판정의 미저장분. reducer 가 정본이고 여기는 저장 흐름의 동기 거울이다. */
  const pendingRelationsRef = useRef<Record<string, RelationEdit>>({});
  useEffect(() => {
    pendingRelationsRef.current = { ...edits.pendingRelations };
  }, [edits.pendingRelations]);

  /** 같은 키의 저장이 도는 동안 두 번째 저장을 막는다. reducer 의 `saving` 보다 동기로 앞선다. */
  const inFlightRef = useRef<Set<EditKey>>(new Set());


  /** 편집 완료 단위로 저장한다. 성공이면 서버 값으로 수렴하고 실패면 편집을 남긴다. */
  const commitItem = useCallback(
    async (itemId: string, edit: ItemEdit): Promise<boolean> => {
      const key: EditKey = `item:${itemId}`;
      if (inFlightRef.current.has(key)) return false;
      inFlightRef.current.add(key);
      dispatch({ type: "saving", key });
      try {
        const result = await enqueue(() => saveItem.mutateAsync({ itemId, edit }));
        bumpVersion(result.reviewVersion);
        // 응답을 먼저 캐시에 반영한다 — 재조회가 늦거나 실패해도 저장한 값과 revision 이 남는다.
        applyMutation(result);
        const saved = { type: "saved" as const, key, reviewVersion: result.reviewVersion, submitted: edit };
        dispatch(saved);
        // 패널이 언마운트된 뒤 도착했어도 보관소에는 닿아야 한다.
        settleStoredEdits(noteId, saved);
        if (JSON.stringify(pendingRef.current[itemId]) === JSON.stringify(edit)) {
          pendingRef.current = withoutKey(pendingRef.current, itemId);
        }
        void invalidateReview();
        return true;
      } catch (error) {
        settleFailure(key, error, edit);
        return false;
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [saveItem, invalidateReview, settleFailure, bumpVersion, applyMutation, noteId, enqueue]
  );

  const commitRelation = useCallback(
    async (relationId: string, edit: RelationEdit): Promise<boolean> => {
      const key: EditKey = `relation:${relationId}`;
      if (inFlightRef.current.has(key)) return false;
      inFlightRef.current.add(key);
      pendingRelationsRef.current = { ...pendingRelationsRef.current, [relationId]: edit };
      dispatch({ type: "edit-relation", relationId, edit });
      dispatch({ type: "saving", key });
      try {
        const result = await enqueue(() => saveRelation.mutateAsync({ relationId, edit }));
        bumpVersion(result.reviewVersion);
        applyMutation(result);
        const saved = { type: "saved" as const, key, reviewVersion: result.reviewVersion, submitted: edit };
        dispatch(saved);
        settleStoredEdits(noteId, saved);
        if (JSON.stringify(pendingRelationsRef.current[relationId]) === JSON.stringify(edit)) {
          pendingRelationsRef.current = withoutKey(pendingRelationsRef.current, relationId);
        }
        void invalidateReview();
        return true;
      } catch (error) {
        settleFailure(key, error, edit);
        return false;
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [saveRelation, invalidateReview, settleFailure, bumpVersion, applyMutation, noteId, enqueue]
  );

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

  /**
   * 승인 전 미저장 편집(항목·관계)을 **순차로** 저장한다 — 각 저장의 응답 버전이 다음 CAS 에
   * 실려야 해서 병렬로 보낼 수 없다. 충돌이 남아 있거나 하나라도 실패하면 승인하지 않는다.
   * 판정은 클릭 시점의 클로저가 아니라 저장 결과와 최신 거울로 한다.
   */
  /** 열려 있는 작성 폼(항목 추가·관계 이름 수정). 승인은 이것이 비어야 나간다. */
  const draftsRef = useRef<Set<string>>(new Set());
  const [draftCount, setDraftCount] = useState(0);
  const onDraftChange = useCallback((key: string, open: boolean) => {
    const next = new Set(draftsRef.current);
    if (open) next.add(key);
    else next.delete(key);
    draftsRef.current = next;
    setDraftCount(next.size);
  }, []);

  const onApprove = useCallback(async () => {
    setRejected(null);
    if (draftsRef.current.size > 0) {
      setRejected({
        code: "REQUEST_FAILED",
        message: "작성 중인 항목 추가나 연결 이름 수정이 있습니다. 저장하거나 취소한 뒤 승인해 주세요.",
      });
      return;
    }
    if (Object.keys(editsRef.current.conflicts).length > 0 || editsRef.current.saving.size > 0) return;
    // reducer 가 정본이다 — 탭을 옮겼다 돌아와 되찾은 편집도 여기에만 있을 수 있다.
    const items = { ...editsRef.current.pendingItems, ...pendingRef.current };
    for (const [itemId, edit] of Object.entries(items)) {
      if (!(await commitItem(itemId, edit))) return;
    }
    const relations = { ...editsRef.current.pendingRelations, ...pendingRelationsRef.current };
    for (const [relationId, edit] of Object.entries(relations)) {
      if (!(await commitRelation(relationId, edit))) return;
    }
    if (
      Object.keys(pendingRef.current).length > 0 ||
      Object.keys(pendingRelationsRef.current).length > 0
    ) {
      return;
    }
    approve.mutate();
  }, [approve, commitItem, commitRelation]);

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
  // 승인 요청이 도는 동안은 잠근다 — 그새 고친 것은 이미 나간 승인에 없고, 성공하면 사라진다.
  const canEdit = isStarter && !review.approved && !approve.isPending;
  const unsavedCount =
    Object.keys(edits.pendingItems).length +
    Object.keys(edits.pendingRelations).length +
    Object.keys(edits.conflicts).length +
    draftCount;

  const itemActions = {
    onSelect: setSelectedItemId,
    onEdit: onEditItem,
    onCommit: onCommitItem,
    // 남아 있는 편집이 있으면 그것을 함께 저장한다 — 빈 저장으로 편집을 지우지 않는다.
    onMarkReviewed: (itemId: string) => void commitItem(itemId, pendingRef.current[itemId] ?? {}),
    onKeepLocal: (itemId: string) => {
      // 사용자가 내 편집을 고른 뒤에만 기준 revision 을 서버 값으로 올린다. reducer 와 ref 둘 다.
      const conflict = editsRef.current.conflicts[`item:${itemId}`];
      if (conflict?.kind === "item") {
        dispatch({ type: "rebase", key: `item:${itemId}`, revision: conflict.server.revision });
        if (pendingRef.current[itemId]) {
          pendingRef.current = {
            ...pendingRef.current,
            [itemId]: { ...pendingRef.current[itemId], baseRevision: conflict.server.revision },
          };
        }
      }
      dispatch({ type: "keep-local", key: `item:${itemId}` });
    },
    onTakeServer: (itemId: string) => {
      pendingRef.current = withoutKey(pendingRef.current, itemId);
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
        approvalDetail={
          !review.approved
            ? null
            : approvalQuery.data
              ? { status: "ready", data: approvalQuery.data }
              : approvalQuery.isError
                ? { status: "error", retry: () => void approvalQuery.refetch() }
                : { status: "loading" }
        }
        onApprove={() => void onApprove()}
        onJumpTo={jumpTo}
      />
      <ReviewRegions
        screen={screen}
        edits={edits}
        selectedItemId={selectedItemId}
        canEdit={canEdit}
        onAddItem={onAddItem}
        actions={itemActions}
        onDraftChange={onDraftChange}
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
        onKeepLocal={(relationId) => {
          const conflict = editsRef.current.conflicts[`relation:${relationId}`];
          if (conflict?.kind === "relation") {
            dispatch({ type: "rebase", key: `relation:${relationId}`, revision: conflict.server.revision });
            if (pendingRelationsRef.current[relationId]) {
              pendingRelationsRef.current = {
                ...pendingRelationsRef.current,
                [relationId]: { ...pendingRelationsRef.current[relationId], baseRevision: conflict.server.revision },
              };
            }
          }
          dispatch({ type: "keep-local", key: `relation:${relationId}` });
        }}
        onDraftChange={onDraftChange}
        onTakeServer={(relationId) => {
          pendingRelationsRef.current = withoutKey(pendingRelationsRef.current, relationId);
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
