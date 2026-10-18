"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Loader2, Plus, Search, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { planBulk, summaryParts, type PlanStatus } from "@/lib/terms/term-bulk";
import {
  TERM_MAX_LENGTH,
  normalizeTerm,
  type Term,
} from "@/lib/terms/term-list";
import type { AddManyOutcome } from "@/lib/terms/use-term-dictionary";

/** 처음 열었을 때 칩이 없으면 눌러 넣어 보는 예시. 구분자가 쉼표인 것도 함께 보인다. */
export const TERM_EXAMPLE = "kubernetes, k8s, 헬름 차트";

/** 미리보기 칩은 이만큼만 그린다 — 엑셀 열을 통째로 붙여 넣어도 입력이 버벅이지 않게. 나머지는 개수로 말한다. */
const PREVIEW_CHIPS_MAX = 120;
/** 등록한 칩이 이보다 많으면 칩 하나하나의 움직임(등장·퇴장·자리 이동)을 끈다. */
const MOTION_CHIPS_MAX = 60;

const PREVIEW_CLASS: Record<PlanStatus, string> = {
  fresh: "border-[var(--el-ink)]/30 bg-white text-[var(--el-ink)]",
  duplicate:
    "border-dashed border-[var(--el-hairline)] bg-transparent text-[var(--el-muted)]",
  tooLong:
    "border-[var(--el-error-strong)]/40 bg-transparent text-[var(--el-error-strong)]",
  overLimit:
    "border-dashed border-[var(--el-hairline)] bg-transparent text-[var(--el-muted)] opacity-60",
};
const PREVIEW_LABEL: Record<PlanStatus, string | null> = {
  fresh: null,
  duplicate: "이미 있어요",
  tooLong: `${TERM_MAX_LENGTH}자 초과`,
  overLimit: "한도 초과",
};

/** 한 번의 추가가 끝난 결과를 한 줄로. */
export function outcomeNotice(outcome: AddManyOutcome): string | null {
  const limit = outcome.rejected.filter((item) => item.reason === "LIMIT");
  const invalid = outcome.rejected.length - limit.length;
  const parts = [
    outcome.added > 0 ? `${outcome.added}개를 더했어요` : null,
    outcome.existing > 0
      ? `이미 있던 ${outcome.existing}개는 건너뛰었어요`
      : null,
    limit.length > 0 ? `한도를 넘어 ${limit.length}개는 못 넣었어요` : null,
    invalid > 0 ? `${invalid}개는 형식이 맞지 않아 뺐어요` : null,
    outcome.failed.length > 0
      ? `${outcome.failed.length}개는 보내지 못했어요. 입력란에 남겼으니 다시 눌러 주세요`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * 워크스페이스 용어 사전의 입력 카드 + 등록한 칩 목록 (APP-1189 · APP-1227).
 *
 * **입력은 처음부터 여러 줄이다.** 쉼표(기본)·줄바꿈·세미콜론·탭으로 나눈 글을 쓰거나 붙여 넣으면 입력하는 동안 아래에
 * 칩 미리보기와 요약(새 · 이미 있어요 · 제외 · 한도)이 보이고 「n개 추가」가 한 번의 동작으로 모두 넣는다. 용어 하나만 적어도
 * 똑같이 Enter 로 들어간다(Shift+Enter 는 줄바꿈, 한글 조합 중 Enter 는 무시).
 *
 * **자리가 안 움직인다.** 미리보기 칸과 카드 아랫줄은 높이가 고정이고 글자만 바뀐다. 판단(중복·한도)은 받아 둔 목록만 본다.
 */
export function TermEditor({
  terms,
  limit,
  onAddMany,
  onRemove,
  progress,
  inputId,
}: {
  terms: readonly Term[];
  limit: number;
  onAddMany: (
    terms: string[],
    handlers: {
      onDone: (outcome: AddManyOutcome) => void;
      onFailed: (terms: string[]) => void;
    }
  ) => void;
  onRemove: (termId: string) => void;
  /** 직렬 대체 경로가 도는 중이면 몇 개째인지. */
  progress?: { done: number; total: number } | null;
  inputId: string;
}) {
  const [value, setValue] = useState("");
  /** 방금 끝난 추가의 결과. 다음 입력에서 지운다. */
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reduced = useReducedMotion();

  const full = terms.length >= limit;
  const plan = planBulk({ text: value, terms, limit });
  const canAdd = plan.fresh.length > 0 && !full;
  const parts = summaryParts(plan);
  const filter = normalizeTerm(query);
  const shown = filter
    ? terms.filter((item) => normalizeTerm(item.term).includes(filter))
    : terms;
  const lite = terms.length > MOTION_CHIPS_MAX;
  const transition = {
    duration: reduced || lite ? 0 : 0.14,
    ease: "easeOut",
  } as const;

  const submit = () => {
    if (!canAdd) return;
    onAddMany(plan.fresh, {
      onDone: (outcome) => {
        setNotice(outcomeNotice(outcome));
        // 못 보낸 것은 입력란에 돌려놓는다 — 그 사이 다른 것을 쓰고 있으면 두지 않는다.
        if (outcome.failed.length > 0)
          setValue((current) =>
            current === "" ? outcome.failed.join(", ") : current
          );
      },
      onFailed: (failed) =>
        setValue((current) => (current === "" ? failed.join(", ") : current)),
    });
    setValue("");
    setNotice(null);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    // 한글 조합 중의 Enter 는 글자를 확정하는 키다 — 추가로 읽지 않는다.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submit();
  };

  const footer: { text: string; tone: "warn" | "muted" | "ink" } | null = full
    ? { text: "다 채웠어요. 하나를 지우면 더할 수 있어요.", tone: "muted" }
    : null;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="rounded-panel border border-[var(--el-hairline)] bg-white transition-shadow focus-within:border-[var(--el-ink)]/40 focus-within:ring-2 focus-within:ring-ring/20">
        <Textarea
          ref={inputRef}
          id={inputId}
          value={value}
          rows={3}
          disabled={full}
          autoComplete="off"
          spellCheck={false}
          aria-label="추가할 용어"
          aria-describedby={`${inputId}-status`}
          placeholder={
            full
              ? "더 넣을 자리가 없어요"
              : `용어를 쉼표나 줄바꿈으로 구분해 한 번에 붙여 넣으세요\n예: ${TERM_EXAMPLE}`
          }
          onChange={(event) => {
            setValue(event.target.value);
            setNotice(null);
          }}
          onKeyDown={onKeyDown}
          className="max-h-48 min-h-[88px] resize-none rounded-b-none rounded-t-panel border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0 md:text-sm"
        />

        {/* 미리보기 칸: 높이가 고정이다. 비어 있어도 같은 자리를 지키고, 많으면 안에서 스크롤한다. */}
        <div
          aria-label="추가할 용어 미리보기"
          className="h-[104px] overflow-y-auto border-t border-[var(--el-hairline)] px-4 py-2.5"
        >
          {plan.total === 0 ? (
            <p className="text-xs leading-5 text-[var(--el-muted)]">
              쉼표(,)·줄바꿈·세미콜론·탭으로 나누면 여기에 미리 보여 드려요.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {plan.items.slice(0, PREVIEW_CHIPS_MAX).map((item, index) => (
                <li key={index} className="max-w-full min-w-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-6 max-w-full rounded-chip px-2.5 text-[13px] font-normal",
                      PREVIEW_CLASS[item.status]
                    )}
                  >
                    <span className="min-w-0 truncate" title={item.term}>
                      {item.term}
                    </span>
                    {PREVIEW_LABEL[item.status] ? (
                      <span className="sr-only">
                        {" "}
                        ({PREVIEW_LABEL[item.status]})
                      </span>
                    ) : null}
                  </Badge>
                </li>
              ))}
              {plan.items.length > PREVIEW_CHIPS_MAX ? (
                <li className="self-center text-xs text-[var(--el-muted)]">
                  외 {plan.items.length - PREVIEW_CHIPS_MAX}개
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <div className="flex min-h-[3.25rem] items-start justify-between gap-3 border-t border-[var(--el-hairline)] px-4 py-2.5">
          <div
            id={`${inputId}-status`}
            className="min-h-10 min-w-0 flex-1 text-xs leading-5 break-keep"
          >
            {progress ? (
              <p
                role="status"
                className="flex items-center gap-1.5 text-[var(--el-ink)]"
              >
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                <span className="tabular-nums">
                  {progress.done} / {progress.total} 추가 중
                </span>
              </p>
            ) : parts.length > 0 ? (
              <p>
                {parts.map((part, index) => (
                  <span
                    key={part.key}
                    className={cn(
                      part.tone === "warn" && "text-[var(--el-error-strong)]",
                      part.tone === "muted" && "text-[var(--el-muted)]",
                      part.tone === "ink" && "font-medium text-[var(--el-ink)]"
                    )}
                  >
                    {index > 0 ? (
                      <span aria-hidden className="text-[var(--el-muted)]">
                        {" · "}
                      </span>
                    ) : null}
                    {part.text}
                  </span>
                ))}
              </p>
            ) : (
              <p role="status" className="text-[var(--el-muted)]">
                {footer?.text ??
                  notice ??
                  "Enter 로 추가 · Shift+Enter 로 줄바꿈"}
              </p>
            )}
          </div>
          <Button
            type="button"
            size="lg"
            disabled={!canAdd}
            onClick={submit}
            className="min-w-[92px] shrink-0 px-3"
          >
            <Plus />
            {canAdd ? `${plan.fresh.length}개 추가` : "추가"}
          </Button>
        </div>
      </div>

      {/* 용량: 숫자와 막대. 막대는 너비를 바꾸지 않고 눈금만 움직인다. */}
      <div className="mt-4 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="넣은 용어"
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={terms.length}
          className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--el-hairline)]"
        >
          <div
            className={cn(
              "h-full origin-left rounded-full transition-transform duration-200 ease-out motion-reduce:transition-none",
              full ? "bg-[var(--el-error-strong)]" : "bg-[var(--el-ink)]"
            )}
            style={{
              transform: `scaleX(${Math.min(1, terms.length / limit)})`,
            }}
          />
        </div>
        <p className="shrink-0 text-xs tabular-nums text-[var(--el-muted)]">
          <span className="sr-only">넣은 용어 </span>
          {terms.length} / {limit}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-[var(--el-ink)]">
          등록한 용어
        </h3>
        <div className="relative w-44 max-w-[50%]">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--el-muted)]"
          />
          <Input
            value={query}
            disabled={terms.length === 0}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="용어 찾기"
            placeholder="용어 찾기"
            autoComplete="off"
            className="h-8 pl-8 text-xs md:text-xs"
          />
        </div>
      </div>

      {/* 칩 목록 칸: 최소 높이를 잡아 비어 있다가 채워져도, 필터로 줄어도 아래가 밀리지 않는다. 많으면 안에서 스크롤. */}
      <div className="mt-3 max-h-[min(360px,45dvh)] min-h-28 overflow-y-auto">
        {terms.length === 0 ? (
          <div className="flex min-h-28 flex-col items-start justify-center gap-2">
            <p className="text-sm text-[var(--el-muted)]">
              아직 등록한 용어가 없어요.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setValue(TERM_EXAMPLE);
                setNotice(null);
                inputRef.current?.focus();
              }}
            >
              예시 넣어 보기
            </Button>
          </div>
        ) : shown.length === 0 ? (
          <p className="pt-2 text-sm text-[var(--el-muted)]">
            찾는 용어가 없어요.
          </p>
        ) : (
          <ul
            ref={listRef}
            aria-label="넣은 용어"
            // 지우기 버튼의 포커스 링이 스크롤 상자에 잘리지 않게 안쪽 여백을 둔다
            className="-mx-1 flex flex-wrap gap-1.5 px-1 pt-0.5 pb-1"
          >
            <AnimatePresence initial={false} mode={lite ? "sync" : "popLayout"}>
              {shown.map((item, index) => (
                <motion.li
                  // 임시 id 칩이 응답으로 실제 id 를 받아도 같은 칩이다 — id 로 키를 잡으면 사라졌다 다시 생긴다.
                  // 한 사전 안에서 용어는 대소문자를 무시하고 하나뿐이라 그것이 키다.
                  key={normalizeTerm(item.term)}
                  layout={lite ? false : "position"}
                  className="max-w-full min-w-0"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={transition}
                >
                  <Badge
                    variant="outline"
                    className="h-7 max-w-full gap-0.5 rounded-chip bg-white pr-0.5 pl-2.5 text-[13px] font-normal text-[var(--el-ink)]"
                  >
                    {/* 40자 용어도 좁은 폭에서 지우기 버튼을 밀어내지 않게 글자만 줄인다. */}
                    <span className="min-w-0 truncate" title={item.term}>
                      {item.term}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      data-chip-remove={normalizeTerm(item.term)}
                      aria-label={`${item.term} 지우기`}
                      className="size-6 text-[var(--el-muted)] hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)]"
                      onClick={() => {
                        onRemove(item.termId);
                        // 지운 칩의 버튼이 사라지면 포커스가 문서 맨 위로 튄다 — 옆 칩(없으면 입력란)으로 옮긴다.
                        const neighbor = shown[index + 1] ?? shown[index - 1];
                        requestAnimationFrame(() => {
                          const next = neighbor
                            ? listRef.current?.querySelector<HTMLButtonElement>(
                                `[data-chip-remove="${CSS.escape(normalizeTerm(neighbor.term))}"]`
                              )
                            : null;
                          (next ?? inputRef.current)?.focus();
                        });
                      }}
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  </Badge>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

/** 칩 목록을 불러오는 동안. 카드·용량·머리글은 실제와 같은 기하로 두고 칩만 막대로 둔다 — 도착해도 안 밀린다. */
export function TermEditorSkeleton() {
  return (
    <div aria-label="용어 사전 불러오는 중" className="flex flex-col">
      <Skeleton className="h-[255px] w-full rounded-panel" />
      <div className="mt-4 flex items-center gap-3">
        <Skeleton className="h-1 flex-1 rounded-full" />
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="mt-5 flex h-8 items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-44 rounded-control" />
      </div>
      <div className="mt-3 flex min-h-28 flex-wrap content-start gap-1.5">
        {[64, 48, 56, 72, 44, 88].map((width, index) => (
          <Skeleton
            key={index}
            className="h-7 rounded-chip"
            style={{ width }}
          />
        ))}
      </div>
    </div>
  );
}
