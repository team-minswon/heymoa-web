"use client";

import { useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Textarea } from "@/components/ui/textarea";
import { errorMessageOf } from "@/lib/api/error-message";
import { REVIEW_KIND_LABEL, type Evidence, type ReviewItem } from "@/lib/notes/meeting-review/select";
import { CONTEXT_KIND_ICON } from "@/lib/notes/proposals/presentation";
import { formatOffset } from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";

export type ItemPatch = { content?: string; included?: boolean };
/** 저장의 CAS 기준 — 사용자가 이 편집을 시작할 때 읽은 판. */
export type SaveBase = { reviewVersion: number; itemRevision: number };
/** 전사 조회의 상태. 인용을 줄로 풀 수 있는지가 여기 달렸다. */
export type TranscriptState = { status: "loading" | "error" | "ready"; retry: () => void };

/**
 * 검토 항목 한 줄. 요약 탭의 `SummaryItem`과 같은 문법이다 — 글줄 하나, 문장 뒤 각주 마커,
 * 펼치면 근거 인용. 여기에 회의 시작자만 보는 두 동작(수정 · 제외/복원)이 줄 끝에 붙는다.
 * 평소엔 흐리고 hover·포커스에서만 선다. 항목이 스무 개면 버튼이 마흔 개 서는 화면을 피한다.
 *
 * 편집은 **완료 단위**로 저장한다 — Enter·blur. 거절되면 편집기를 닫지 않고 사유를 그 줄에
 * 남긴다. 서버가 이미 저장한 편집은 사라지지 않고, 지금 쓰던 글자도 사라지지 않는다.
 */
export function ReviewItemRow({
  item,
  evidence,
  transcript,
  reviewVersion,
  canEdit,
  onEvidenceSelect,
  onSave,
}: {
  item: ReviewItem;
  /** 지금 화면이 읽은 검토본 판. 편집을 여는 순간의 값이 그 편집의 CAS 기준이 된다. */
  reviewVersion: number;
  /** 인용을 전사 줄로 푼 것. 전사가 아직 없으면 빈 배열이다. */
  evidence: Evidence[];
  transcript: TranscriptState;
  canEdit: boolean;
  onEvidenceSelect: (segmentId: string) => void;
  /** 거절은 reject 다. 이 줄이 사유를 그린다. */
  onSave: (itemId: string, patch: ItemPatch, base: SaveBase) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.content);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const evidenceId = `evidence-${item.itemId}`;
  const citationCount = item.citations.length;

  // 편집기를 연 순간의 판. 열려 있는 동안 폴링이 새 판을 가져와도 이 값으로 저장해 409 를 받는다.
  const [base, setBase] = useState<SaveBase | null>(null);
  const currentBase = (): SaveBase => ({ reviewVersion, itemRevision: item.revision });

  // **동기 잠금.** Enter 저장이 `pending` 으로 textarea 를 비활성화하면 그 순간 blur 가 나서
  // `commitContent` 를 한 번 더 부른다. state 는 아직 안 바뀐 뒤라 ref 로 막는다.
  const savingRef = useRef(false);

  const save = async (patch: ItemPatch, at: SaveBase) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setPending(true);
    setFailure(null);
    try {
      await onSave(item.itemId, patch, at);
      setEditing(false);
    } catch (error) {
      setFailure(errorMessageOf(error, "저장하지 못했습니다."));
      // 충돌을 봤으면 사용자는 서버 값을 알고 있다. 다음 저장은 최신 판을 기준으로 한다.
      setBase(null);
    } finally {
      savingRef.current = false;
      setPending(false);
    }
  };
  const commitContent = () => {
    if (savingRef.current) return;
    const next = draft.trim();
    if (!next || next === item.content) {
      setEditing(false);
      setDraft(item.content);
      return;
    }
    void save({ content: next }, base ?? currentBase());
  };
  const beginEditing = () => {
    setDraft(item.content);
    setFailure(null);
    setBase(currentBase());
    setEditing(true);
  };

  // 할 일은 담당·기한이 비어 있는 것도 보여야 한다 — 채울 자리가 있다는 뜻이다. 다른 유형은
  // 값이 있을 때만 적는다. 「고침」「직접 추가」는 본인이 한 일이라 적지 않는다.
  const meta =
    item.kind === "ACTION_ITEM"
      ? [`담당 ${item.assigneeText ?? "미정"}`, `기한 ${item.dueText ?? "미정"}`]
      : [
          item.assigneeText ? `담당 ${item.assigneeText}` : null,
          item.dueText ? `기한 ${item.dueText}` : null,
        ].filter(Boolean);
  const KindIcon = CONTEXT_KIND_ICON[item.kind];

  const claim = (
    <>
      {item.content}
      {citationCount ? (
        <>
          <span className="sr-only">{` 근거 ${citationCount}개`}</span>
          <span
            aria-hidden
            className={cn(
              "ml-1.5 inline-flex translate-y-[-1px] items-center gap-0.5 rounded-chip px-1.5 py-0.5 align-baseline font-mono text-[11px] tabular-nums transition-colors",
              open
                ? "bg-[var(--el-surface-strong)] text-[var(--el-ink)]"
                : "text-[var(--el-muted-soft)] group-hover/claim:bg-[var(--el-surface-strong)] group-hover/claim:text-[var(--el-ink)]"
            )}
          >
            {citationCount}
            <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
          </span>
        </>
      ) : null}
    </>
  );

  return (
    <li
      data-testid="review-item"
      data-item-id={item.itemId}
      data-excluded={item.included ? undefined : ""}
      className="group/row relative pl-6"
    >
      {/* 유형은 머리글이 아니라 줄 앞의 표식이다. 레일과 같은 아이콘이라 어느 쪽에서 봐도 같다. */}
      <KindIcon
        aria-hidden
        className="absolute left-0 top-[7px] size-3.5 text-[var(--el-muted-soft)]"
      />
      <span className="sr-only">{REVIEW_KIND_LABEL[item.kind]} </span>
      {editing ? (
        <Textarea
          autoFocus
          aria-label="항목 내용"
          value={draft}
          rows={2}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => {
            // 「최신 판 위에 저장」으로 가는 포커스 이동이다. 여기서 저장하면 그 클릭이 죽는다.
            if (event.relatedTarget instanceof HTMLElement && event.relatedTarget.dataset.retrySave !== undefined) return;
            commitContent();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              commitContent();
            } else if (event.key === "Escape") {
              setDraft(item.content);
              setEditing(false);
            }
          }}
          className="min-h-0 text-[15px] leading-7"
        />
      ) : (
        <div className="flex items-start gap-2">
          {citationCount ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={evidenceId}
              onClick={(event) => {
                // 드래그로 글자를 집은 뒤의 click 은 펼치지 않는다. 키보드(detail 0)는 늘 펼친다.
                if (event.detail > 0 && !window.getSelection()?.isCollapsed) return;
                setOpen((current) => !current);
              }}
              className="group/claim -mx-2 block min-w-0 flex-1 select-text rounded-block px-2 py-0.5 text-left transition-colors hover:bg-[var(--el-canvas-soft)]"
            >
              <span className={cn("block break-keep text-[15px] leading-7", contentTone(item))}>
                {claim}
              </span>
            </button>
          ) : (
            <p className={cn("min-w-0 flex-1 break-keep py-0.5 text-[15px] leading-7", contentTone(item))}>
              {claim}
            </p>
          )}
          {canEdit ? (
            <span className="flex shrink-0 gap-2.5 pt-1 text-[12px] text-[var(--el-muted)] opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
              {item.included ? (
                <button type="button" disabled={pending} onClick={beginEditing} className="hover:text-[var(--el-ink)]">
                  수정
                </button>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => void save({ included: !item.included }, currentBase())}
                className="hover:text-[var(--el-ink)]"
              >
                {item.included ? "제외" : "복원"}
              </button>
            </span>
          ) : null}
        </div>
      )}

      {meta.length ? (
        <p className="mt-0.5 text-[12px] text-[var(--el-muted)]">{meta.join(" · ")}</p>
      ) : null}
      {failure ? (
        <p role="alert" className="mt-1 text-[12px] text-[var(--el-error-strong)]">
          {failure}
          {editing ? (
            // 거절 뒤 부모는 최신 검토본을 다시 읽는다. 초안은 그대로 두고, 지금 서버 값을 보여 준
            // 뒤 그 판을 기준으로 다시 저장할 길을 준다 — Escape 로 초안을 버리게 하지 않는다.
            <span className="ml-2 text-[var(--el-muted)]">
              서버 값 「{item.content}」
              <button
                type="button"
                data-retry-save
                disabled={pending}
                onClick={() => {
                  const next = draft.trim();
                  if (next) void save({ content: next }, currentBase());
                }}
                className="ml-2 text-[var(--el-ink)] underline underline-offset-2"
              >
                최신 판 위에 저장
              </button>
            </span>
          ) : null}
        </p>
      ) : null}

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="evidence"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <ul id={evidenceId} className="mt-3 space-y-2 border-l border-[var(--el-hairline-strong)] pl-4">
              {evidence.length ? (
                evidence.map((row) => (
                  <li key={row.segmentId}>
                    <button
                      type="button"
                      onClick={() => onEvidenceSelect(row.segmentId)}
                      className="group -mx-2 flex w-full items-baseline gap-2 rounded-block px-2 py-1 text-left transition-colors hover:bg-[var(--el-canvas-soft)]"
                    >
                      {row.speakerLabel ? (
                        <span className="shrink-0 font-mono text-[11px] text-[var(--el-muted-soft)]">
                          {row.speakerLabel}
                        </span>
                      ) : null}
                      <span className="min-w-0 break-keep font-serif text-[15px] leading-7 text-[var(--el-body)]">
                        {row.text}
                      </span>
                      <span
                        aria-hidden
                        className="min-w-0 flex-1 translate-y-[-4px] border-b border-dotted border-[var(--el-hairline)]"
                      />
                      <time className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)] transition-colors group-hover:text-[var(--el-muted)]">
                        {formatOffset(row.startedAtMs)}
                      </time>
                    </button>
                  </li>
                ))
              ) : transcript.status === "loading" ? (
                <li role="status" className="flex items-center gap-2 text-[13px] text-[var(--el-muted)]">
                  <Loader2 aria-hidden className="size-3.5 animate-spin" />
                  전사를 불러오는 중입니다.
                </li>
              ) : transcript.status === "error" ? (
                <li role="alert" className="flex items-center gap-2 text-[13px] text-[var(--el-muted)]">
                  전사를 불러오지 못했습니다.
                  <button type="button" onClick={transcript.retry} className="text-[var(--el-ink)] underline underline-offset-2">
                    다시 시도
                  </button>
                </li>
              ) : (
                <li className="text-[13px] text-[var(--el-muted-soft)]">전사에서 그 발화를 찾지 못했습니다.</li>
              )}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

function contentTone(item: ReviewItem) {
  return item.included ? "text-[var(--el-ink)]" : "text-[var(--el-muted-soft)] line-through";
}
