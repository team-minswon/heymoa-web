"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Loader2, Plus, Search, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

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

const PREVIEW_CHIPS_MAX = 120;
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
type Translate = ReturnType<typeof useTranslations<"settings.terms">>;

function outcomeNotice(
  outcome: AddManyOutcome,
  t: Translate
): string | null {
  const limit = outcome.rejected.filter((item) => item.reason === "LIMIT");
  const invalid = outcome.rejected.length - limit.length;
  const parts = [
    outcome.added > 0 ? t("outcome.added", { count: outcome.added }) : null,
    outcome.existing > 0
      ? t("outcome.existing", { count: outcome.existing })
      : null,
    limit.length > 0 ? t("outcome.overLimit", { count: limit.length }) : null,
    invalid > 0 ? t("outcome.invalid", { count: invalid }) : null,
    outcome.failed.length > 0
      ? t("outcome.failed", { count: outcome.failed.length })
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

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
  progress?: { done: number; total: number } | null;
  inputId: string;
}) {
  const t = useTranslations("settings.terms");
  const [value, setValue] = useState("");
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
        setNotice(outcomeNotice(outcome, t));
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
    ? { text: t("full"), tone: "muted" }
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
          aria-label={t("input")}
          aria-describedby={`${inputId}-status`}
          placeholder={
            full
              ? t("fullPlaceholder")
              : `${t("placeholder")}\n${t("examplePrefix", { example: t("example") })}`
          }
          onChange={(event) => {
            setValue(event.target.value);
            setNotice(null);
          }}
          onKeyDown={onKeyDown}
          className="max-h-48 min-h-[88px] resize-none rounded-b-none rounded-t-panel border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0 md:text-sm"
        />

        <div
          aria-label={t("preview")}
          className="h-[104px] overflow-y-auto border-t border-[var(--el-hairline)] px-4 py-2.5"
        >
          {plan.total === 0 ? (
            <p className="text-xs leading-5 text-[var(--el-muted)]">
              {t("previewHint")}
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
                    {item.status !== "fresh" ? (
                      <span className="sr-only">
                        {" "}
                        (
                        {t(`previewStatus.${item.status}`, {
                          max: TERM_MAX_LENGTH,
                        })}
                        )
                      </span>
                    ) : null}
                  </Badge>
                </li>
              ))}
              {plan.items.length > PREVIEW_CHIPS_MAX ? (
                <li className="self-center text-xs text-[var(--el-muted)]">
                  {t("more", { count: plan.items.length - PREVIEW_CHIPS_MAX })}
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <div className="flex min-h-[3.25rem] items-start justify-between gap-3 border-t border-[var(--el-hairline)] px-4 py-2.5">
          <div
            id={`${inputId}-status`}
            className="min-h-10 min-w-0 flex-1 text-xs leading-5"
          >
            {progress ? (
              <p
                role="status"
                className="flex items-center gap-1.5 text-[var(--el-ink)]"
              >
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                <span className="tabular-nums">
                  {t("progress", { done: progress.done, total: progress.total })}
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
                    {t(`summary.${part.key}`, {
                      count: part.count,
                      max: TERM_MAX_LENGTH,
                    })}
                  </span>
                ))}
              </p>
            ) : (
              <p role="status" className="text-[var(--el-muted)]">
                {footer?.text ?? notice ?? t("keyHint")}
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
            {canAdd ? t("addCount", { count: plan.fresh.length }) : t("add")}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label={t("added")}
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
          <span className="sr-only">{t("added")} </span>
          {terms.length} / {limit}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-[var(--el-ink)]">
          {t("listTitle")}
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
            aria-label={t("search")}
            placeholder={t("search")}
            autoComplete="off"
            className="h-8 pl-8 text-xs md:text-xs"
          />
        </div>
      </div>

      <div className="mt-3 max-h-[min(360px,45dvh)] min-h-28 overflow-y-auto">
        {terms.length === 0 ? (
          <div className="flex min-h-28 flex-col items-start justify-center gap-2">
            <p className="text-sm text-[var(--el-muted)]">
              {t("empty")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setValue(t("example"));
                setNotice(null);
                inputRef.current?.focus();
              }}
            >
              {t("tryExample")}
            </Button>
          </div>
        ) : shown.length === 0 ? (
          <p className="pt-2 text-sm text-[var(--el-muted)]">
            {t("noMatch")}
          </p>
        ) : (
          <ul
            ref={listRef}
            aria-label={t("added")}
            className="-mx-1 flex flex-wrap gap-1.5 px-1 pt-0.5 pb-1"
          >
            <AnimatePresence initial={false} mode={lite ? "sync" : "popLayout"}>
              {shown.map((item, index) => (
                <motion.li
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
                    <span className="min-w-0 truncate" title={item.term}>
                      {item.term}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      data-chip-remove={normalizeTerm(item.term)}
                      aria-label={t("remove", { term: item.term })}
                      className="size-6 text-[var(--el-muted)] hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)]"
                      onClick={() => {
                        onRemove(item.termId);
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

export function TermEditorSkeleton() {
  const t = useTranslations("settings.terms");
  return (
    <div aria-label={t("loading")} className="flex flex-col">
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
