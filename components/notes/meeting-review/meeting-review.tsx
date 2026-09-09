"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  getGetMeetingReviewQueryKey,
  useCreateMeetingReview,
  useCreateMeetingReviewItem,
  useGetMeetingReview,
  useUpdateMeetingReviewItem,
  type getMeetingReviewResponse200,
} from "@/lib/api/generated/meeting-review/meeting-review";
import type { MeetingReviewResponse } from "@/lib/api/generated/models";
import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";
import {
  REVIEW_KIND_LABEL,
  REVIEW_KIND_ORDER,
  groupReviewItems,
  resolveCitations,
  type ReviewKind,
} from "@/lib/notes/meeting-review/select";

import {
  ReviewItemRow,
  type ItemPatch,
  type SaveBase,
  type TranscriptState,
} from "./review-item";

/**
 * 종료된 회의의 검토본. `summary` 탭의 본문이다.
 *
 * 서버 상태는 Query 캐시 하나다. 저장 응답이 검토본 전체라 그대로 캐시에 쓰고, 거절되면
 * 다시 읽는다 — 화면이 따로 상태를 들지 않으니 탭을 오가도 잃을 것이 편집기 하나뿐이다.
 *
 * 승인·관계·평가는 없다. 계약(`openapi3.yml`)에 그 경로가 아직 없다.
 */
export function MeetingReview({
  noteId,
  canEdit,
  onEvidenceSelect,
  onHasReview,
}: {
  noteId: string;
  /** 회의 시작자. 최종 판정은 서버(403)이고 이 값은 컨트롤을 그릴지만 정한다. */
  canEdit: boolean;
  onEvidenceSelect: (segmentId: string) => void;
  /** 검토본이 있는지. 부모가 「이전 분석」을 접을지 정한다. */
  onHasReview?: (hasReview: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = getGetMeetingReviewQueryKey(noteId);
  const reviewQuery = useGetMeetingReview(noteId, {
    query: {
      retry: false,
      // 시작자의 편집은 응답으로 캐시에 들어온다. 읽기만 하는 참여자는 남의 변경을 받을
      // 길이 없으니 저주기 폴링과 창 포커스로 따라간다. 요약 탭이 keepMounted 라 재마운트 refetch 는 없다.
      refetchOnWindowFocus: true,
      refetchInterval: canEdit ? false : 30_000,
    },
  });
  const transcriptQuery = useGetNoteTranscript(noteId, {
    query: { staleTime: 60_000, refetchOnWindowFocus: true },
  });

  const review =
    reviewQuery.data?.status === 200 && reviewQuery.data.data.success
      ? reviewQuery.data.data.data
      : null;
  const missing = errorCodeOf(reviewQuery.error) === "MEETING_REVIEW_NOT_FOUND";
  const segments =
    transcriptQuery.data?.status === 200 && transcriptQuery.data.data.success
      ? transcriptQuery.data.data.data.segments
      : [];
  // 전사가 아직 없거나 못 받은 것과 인용이 전사에 없는 것은 다른 일이다. 근거 줄이 가른다.
  const transcript: TranscriptState = {
    status: transcriptQuery.isLoading ? "loading" : transcriptQuery.isError ? "error" : "ready",
    retry: () => void transcriptQuery.refetch(),
  };

  const hasReview = review !== null;
  useEffect(() => onHasReview?.(hasReview), [hasReview, onHasReview]);

  // 응답이 검토본 전체다. 캐시에 바로 쓰면 재조회 없이 새 revision 으로 다음 저장을 잇는다.
  // 항목 추가는 201 로 오지만 조회 캐시는 200 만 검토본으로 읽으니 상태 코드를 맞춰 넣는다.
  const settle = {
    // 저장이 시작되면 날아가고 있는 조회를 끊는다. 늦게 도착한 옛 검토본이 방금 저장한
    // 응답을 캐시에서 덮지 않게.
    onMutate: () => queryClient.cancelQueries({ queryKey }),
    onSuccess: (response: { status: number; data: unknown }) => {
      // mutator 는 2xx 만 resolve 한다. 그 본문은 전부 검토본 응답이다.
      if (response.status !== 200 && response.status !== 201) return;
      queryClient.setQueryData<getMeetingReviewResponse200>(queryKey, {
        data: response.data as MeetingReviewResponse,
        status: 200,
      });
    },
    // 거절(대개 409)이면 서버 판이 앞섰다. 다시 읽어야 다음 저장의 CAS 가 맞는다.
    onError: () => void queryClient.invalidateQueries({ queryKey }),
  };
  const create = useCreateMeetingReview({ mutation: settle });
  const update = useUpdateMeetingReviewItem({
    mutation: { ...settle, meta: { suppressErrorToast: true } },
  });
  const add = useCreateMeetingReviewItem({
    mutation: { ...settle, meta: { suppressErrorToast: true } },
  });

  const [adding, setAdding] = useState(false);

  if (reviewQuery.isLoading) return <ReviewSkeleton />;

  if (missing) {
    return (
      <div className="rounded-panel border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-5">
        <p className="text-sm font-medium text-[var(--el-ink)]">아직 검토본이 없습니다</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--el-muted)]">
          {canEdit
            ? "회의에서 나온 명제를 검토본으로 만들어 확인하고 고칩니다."
            : "회의 시작자가 검토본을 만들면 여기에 보입니다."}
        </p>
        {canEdit ? (
          <Button
            size="sm"
            className="mt-3 h-[30px]"
            loading={create.isPending}
            onClick={() => create.mutate({ noteId })}
          >
            검토본 만들기
          </Button>
        ) : null}
      </div>
    );
  }

  if (!review) {
    return <InlineRetry label="검토본을 불러오지 못했습니다" onRetry={() => void reviewQuery.refetch()} />;
  }

  // CAS 기준은 **사용자가 읽은 판**이다. 줄이 편집을 열 때 잡아 둔 값을 그대로 보낸다 —
  // 편집 중 폴링이 새 판을 받아 와도 그것으로 갈아타면 남의 변경 위에 조용히 덮어쓴다.
  const save = (itemId: string, patch: ItemPatch, base: SaveBase) =>
    update.mutateAsync({
      noteId,
      itemId,
      data: {
        ...patch,
        expectedReviewVersion: base.reviewVersion,
        expectedItemRevision: base.itemRevision,
      },
    });
  const sections = groupReviewItems(review.items);

  return (
    <div data-testid="meeting-review">
      {canEdit ? (
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-[30px]"
            disabled={adding}
            onClick={() => setAdding(true)}
          >
            항목 추가
          </Button>
        </div>
      ) : null}
      {adding ? (
        <AddItemForm
          pending={add.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(kind, content) =>
            add
              .mutateAsync({
                noteId,
                data: { kind, content, expectedReviewVersion: review.reviewVersion },
              })
              .then(() => setAdding(false))
          }
        />
      ) : null}
      {sections.length ? (
        <div className="mt-6 space-y-14">
          {sections.map((section) => (
            <section key={section.kind} aria-label={section.label}>
              <div className="flex items-baseline justify-between gap-4 border-b border-[var(--el-hairline-strong)] pb-2">
                <h2 className="font-serif text-xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
                  {section.label}
                </h2>
                <span className="font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
                  {section.items.length}
                </span>
              </div>
              <ul className="mt-5 space-y-5">
                {section.items.map((item) => (
                  <ReviewItemRow
                    key={item.itemId}
                    item={item}
                    evidence={resolveCitations(item.citations, segments)}
                    transcript={transcript}
                    reviewVersion={review.reviewVersion}
                    canEdit={canEdit}
                    onEvidenceSelect={onEvidenceSelect}
                    onSave={save}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-[var(--el-muted)]">검토할 항목이 없습니다.</p>
      )}
    </div>
  );
}

/**
 * 사람이 항목을 더한다. 종류는 네이티브 select — 일곱 중 하나를 고르는 데 메뉴 컴포넌트가
 * 필요하지 않다. 거절은 폼 안에 남긴다(토스트는 opt-out).
 */
function AddItemForm({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (kind: ReviewKind, content: string) => Promise<unknown>;
}) {
  const [kind, setKind] = useState<ReviewKind>("DECISION");
  const [content, setContent] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const submit = () => {
    const next = content.trim();
    if (!next) return;
    setFailure(null);
    onSubmit(kind, next).catch((error) =>
      setFailure(errorMessageOf(error, "추가하지 못했습니다."))
    );
  };
  return (
    <form
      className="mt-3 space-y-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-2">
        <select
          aria-label="항목 종류"
          value={kind}
          disabled={pending}
          onChange={(event) => setKind(event.target.value as ReviewKind)}
          className="h-[30px] rounded-control border border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-2 text-[13px] text-[var(--el-ink)]"
        >
          {REVIEW_KIND_ORDER.map((option) => (
            <option key={option} value={option}>
              {REVIEW_KIND_LABEL[option]}
            </option>
          ))}
        </select>
      </div>
      <Textarea
        autoFocus
        aria-label="항목 내용"
        rows={2}
        value={content}
        disabled={pending}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
          } else if (event.key === "Escape") {
            onCancel();
          }
        }}
        className="bg-[var(--el-surface-card)] text-[15px] leading-7"
      />
      {failure ? (
        <p role="alert" className="text-[12px] text-[var(--el-error-strong)]">
          {failure}
        </p>
      ) : null}
      <div className="flex justify-end gap-1">
        <Button type="button" variant="ghost" size="sm" className="h-[30px]" disabled={pending} onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" size="sm" className="h-[30px]" loading={pending} disabled={!content.trim()}>
          추가
        </Button>
      </div>
    </form>
  );
}

/** 조회 스켈레톤. 섹션 이름은 응답이 정하므로 머리글도 막대다 — 요약 탭과 달리 고정 셋이 아니다. */
function ReviewSkeleton() {
  return (
    <div className="mt-6 space-y-14" aria-label="검토본 불러오는 중">
      {[
        ["78%", "54%"],
        ["64%", "82%", "47%"],
      ].map((rows, index) => (
        <section key={index}>
          <div className="border-b border-[var(--el-hairline-strong)] pb-2">
            <Skeleton className="h-7 w-16 rounded-chip" />
          </div>
          <div className="mt-5 space-y-5">
            {rows.map((width, row) => (
              <Skeleton key={row} className="h-7 rounded-chip" style={{ width }} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
