"use client";

import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  TERM_MAX_LENGTH,
  normalizeTerm,
  splitPastedTerms,
  type Term,
} from "@/lib/terms/term-list";

/**
 * 용어 사전 하나의 입력 + 칩 목록 (APP-1189). 워크스페이스 탭과 프로젝트 창이 같은 것을 쓴다.
 *
 * **입력 아래 한 줄은 늘 자리를 잡고 있다.** 왼쪽은 안내(중복 · 한도 · 붙여넣기 결과), 오른쪽은 「37 / 200」이다.
 * 안내가 생기고 사라져도 높이가 그대로라 아래 칩 목록이 밀리지 않는다 — 글자는 투명도만 바뀐다.
 *
 * 중복은 **입력하는 동안** 알리고 추가를 막는다. 누른 뒤에 알리지 않는다. 판단은 캐시(받아 둔 목록)만 본다.
 */
export function TermEditor({
  terms,
  limit,
  onAdd,
  onRemove,
  blockedReason,
  isDimmed,
  dimmedNote,
  inputId,
  scrollList = false,
}: {
  terms: readonly Term[];
  limit: number;
  onAdd: (term: string, onFailed?: (term: string) => void) => void;
  onRemove: (termId: string) => void;
  /** 이 사전 밖의 이유로 막을 때의 안내(프로젝트 쪽: 워크스페이스 사전에 이미 있다). 없으면 null. */
  blockedReason?: (term: string) => string | null;
  /** 옅게 그릴 칩(워크스페이스에도 있는 프로젝트 용어). */
  isDimmed?: (term: Term) => boolean;
  /** 옅은 칩이 있을 때 목록 아래 한 줄. */
  dimmedNote?: (count: number) => string;
  inputId: string;
  /** 창 안에서 칩이 많을 때 입력란은 그대로 두고 목록만 스크롤한다. */
  scrollList?: boolean;
}) {
  const [value, setValue] = useState("");
  /** 붙여넣기 결과처럼 방금 한 일의 안내. 다음 입력에서 지운다. */
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reduced = useReducedMotion();

  const keys = new Set(terms.map((item) => normalizeTerm(item.term)));
  const draft = value.trim();
  const full = terms.length >= limit;
  const duplicate = draft !== "" && keys.has(normalizeTerm(draft));
  const outside =
    draft !== "" && !duplicate ? (blockedReason?.(draft) ?? null) : null;
  const block = duplicate ? "이미 있어요" : outside;
  const canAdd = draft !== "" && !block && !full;

  const message: { text: string; tone: "warn" | "muted" } | null = block
    ? { text: block, tone: "warn" }
    : full
      ? {
          text: "다 채웠어요. 하나를 지우면 더할 수 있어요.",
          tone: "muted",
        }
      : value.length >= TERM_MAX_LENGTH
        ? { text: `용어 하나는 ${TERM_MAX_LENGTH}자까지예요.`, tone: "muted" }
        : notice
          ? { text: notice, tone: "muted" }
          : null;
  // 안내가 사라질 때 글자가 먼저 비면 투명해지는 동안 볼 것이 없다 — 마지막 문구를 붙들고 투명도만 내린다.
  const [shown, setShown] = useState(message);
  if (message && (message.text !== shown?.text || message.tone !== shown.tone))
    setShown(message);

  const submit = () => {
    if (!canAdd) return;
    // 실패하면 칩은 되돌아가고 토스트가 뜬다. 지운 입력도 돌려놓는다 — 그 사이 다른 것을 쓰고 있으면 두지 않는다.
    onAdd(draft, (term) =>
      setValue((current) => (current === "" ? term : current))
    );
    setValue("");
    setNotice(null);
  };

  const dimmedCount = isDimmed ? terms.filter(isDimmed).length : 0;
  const transition = { duration: reduced ? 0 : 0.16, ease: "easeOut" } as const;

  return (
    <div className="flex min-h-0 flex-col">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          ref={inputRef}
          id={inputId}
          value={value}
          maxLength={TERM_MAX_LENGTH}
          disabled={full}
          autoComplete="off"
          placeholder={full ? "더 넣을 자리가 없어요" : "용어를 입력하고 Enter"}
          aria-label="추가할 용어"
          aria-describedby={`${inputId}-hint`}
          aria-invalid={block ? true : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setNotice(null);
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (!/\r?\n/.test(text.trim())) return;
            // 여러 줄이면 줄마다 하나씩 넣는다. 한 줄이면 입력란에 그대로 붙는다.
            event.preventDefault();
            const split = splitPastedTerms(text, terms);
            // 다른 사전에 이미 있는 줄은 입력할 때처럼 막는다 — 한도 계산에도 넣지 않는다.
            const lines = split.terms.filter((term) => !blockedReason?.(term));
            const outside = split.terms.length - lines.length;
            const { tooLong, duplicates } = split;
            const room = Math.max(0, limit - terms.length);
            const taken = lines.slice(0, room);
            const over = lines.length - taken.length;
            for (const term of taken) onAdd(term);
            const parts = [
              taken.length > 0 ? `${taken.length}개를 더했어요` : null,
              duplicates + outside > 0
                ? `${duplicates + outside}개는 이미 있어요`
                : null,
              tooLong > 0
                ? `${tooLong}줄은 ${TERM_MAX_LENGTH}자를 넘어 뺐어요`
                : null,
              over > 0 ? `${over}개는 한도를 넘어 못 넣었어요` : null,
            ].filter(Boolean);
            setNotice(parts.join(" · ") || null);
          }}
          className="h-9 flex-1"
        />
        <Button type="submit" size="lg" disabled={!canAdd} className="px-3">
          <Plus /> 추가
        </Button>
      </form>

      <div
        id={`${inputId}-hint`}
        className="mt-1.5 flex min-h-5 items-start justify-between gap-3 text-xs leading-5"
      >
        <p
          aria-live="polite"
          // 사라지는 중인 지난 안내는 투명도만 내린다 — 보조기술에는 지금 안내만 읽힌다.
          aria-hidden={message ? undefined : true}
          className={cn(
            "min-w-0 break-keep transition-opacity duration-150 ease-out motion-reduce:transition-none",
            message ? "opacity-100" : "opacity-0",
            shown?.tone === "warn"
              ? "text-[var(--el-error-strong)]"
              : "text-[var(--el-muted)]"
          )}
        >
          {message ? message.text : shown?.text}
        </p>
        <p className="shrink-0 tabular-nums text-[var(--el-muted)]">
          <span className="sr-only">넣은 용어 </span>
          {terms.length} / {limit}
        </p>
      </div>

      {terms.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--el-muted)]">
          아직 넣은 용어가 없어요.
        </p>
      ) : (
        <ul
          ref={listRef}
          aria-label="넣은 용어"
          className={cn(
            "mt-4 flex flex-wrap gap-1.5",
            // 지우기 버튼의 포커스 링이 스크롤 상자에 잘리지 않게 안쪽 여백을 둔다
            scrollList && "-mx-1 min-h-0 overflow-y-auto px-1 pt-0.5 pb-1"
          )}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {terms.map((item, index) => {
              const dimmed = isDimmed?.(item) ?? false;
              return (
                <motion.li
                  // 임시 id 칩이 응답으로 실제 id 를 받아도 같은 칩이다 — id 로 키를 잡으면 사라졌다 다시 생긴다.
                  // 한 사전 안에서 용어는 대소문자를 무시하고 하나뿐이라 그것이 키다.
                  key={normalizeTerm(item.term)}
                  layout="position"
                  className="max-w-full min-w-0"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={transition}
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-7 max-w-full gap-0.5 rounded-chip bg-white pr-0.5 pl-2.5 text-[13px] font-normal text-[var(--el-ink)]",
                      dimmed &&
                        "border-dashed bg-transparent text-[var(--el-muted)]"
                    )}
                  >
                    {/* 40자 용어도 좁은 폭에서 지우기 버튼을 밀어내지 않게 글자만 줄인다. */}
                    <span className="min-w-0 truncate" title={item.term}>
                      {item.term}
                    </span>
                    {dimmed ? (
                      <span className="sr-only">
                        {" "}
                        (워크스페이스 사전에도 있음)
                      </span>
                    ) : null}
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
                        const neighbor = terms[index + 1] ?? terms[index - 1];
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
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {dimmedCount > 0 && dimmedNote ? (
        <p className="mt-3 text-xs text-[var(--el-muted)]">
          {dimmedNote(dimmedCount)}
        </p>
      ) : null}
    </div>
  );
}

/** 칩 목록을 불러오는 동안. 입력란과 안내 줄은 그대로 그리고 칩만 막대로 둔다 — 도착해도 안 밀린다. */
export function TermEditorSkeleton({ children }: { children?: ReactNode }) {
  return (
    <div aria-label="용어 사전 불러오는 중" className="flex flex-col">
      {children}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 flex-1 rounded-control" />
        <Skeleton className="h-9 w-[68px] rounded-control" />
      </div>
      <div className="mt-1.5 min-h-5" />
      <div className="mt-4 flex flex-wrap gap-1.5">
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
