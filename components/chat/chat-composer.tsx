"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { ArrowUp, FileText, Folder, Square, X } from "lucide-react";

import {
  scopeChipClass,
  scopeKey,
  type ScopeChip,
} from "@/lib/chat/scope-chip";
import { toast } from "@/lib/ui/toast";

// server 계약의 상한이다. 넘으면 400 이라 붙이기 전에 막는다.
const MAX_SCOPE_ITEMS = 20;
import {
  MentionInput,
  type MentionHandle,
} from "@/components/chat/mention-input";
import { ScopePicker } from "@/components/chat/scope-picker";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { matchScope, type ScopeCandidate } from "@/lib/chat/use-scope-catalog";

/**
 * 개인 챗봇 입력부. 칩은 `@` 를 친 자리에 문장 안으로 박힌다. 편집기는 `MentionInput` 이고
 * 여기는 그 둘레(피커·보내기·안내)다.
 *
 * 답이 흐르는 동안에도 입력은 열어 두고 전송만 막는다. 앞 턴이 끝나기 전에 보내면 그
 * 스트림이 끊겨 흐르던 답을 잃는다.
 */
export function ChatComposer({
  inputRef,
  onSubmit,
  onStop,
  isBusy,
  isStreaming,
  placeholder,
  shortPlaceholder,
  footer,
  scope,
  onChipsChange,
  onMentioningChange,
}: {
  inputRef: React.RefObject<MentionHandle | null>;
  /** 편집기에서 읽은 문장과 칩. 비었으면 부르지 않는다. */
  onSubmit: (draft: { text: string; chips: ScopeChip[] }) => void;
  onStop: () => void;
  /** 보낼 수 없는 상태. 입력은 그대로 열려 있다. */
  isBusy: boolean;
  isStreaming: boolean;
  placeholder: string;
  /** 좁은 폭에서 쓰는 짧은 안내. 긴 안내가 잘리면 문장이 끊겨 읽힌다. */
  shortPlaceholder?: string;
  footer?: React.ReactNode;
  scope?: {
    candidates: { projects: ScopeCandidate[]; notes: ScopeCandidate[] };
    isPending: boolean;
    taken: Set<string>;
  };
  onChipsChange: (chips: ScopeChip[]) => void;
  /** `@` 를 치기 시작했다. 부모가 이때 목록을 받아 온다. */
  onMentioningChange?: (mentioning: boolean) => void;
}) {
  const pickerId = useId();
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);
  /** 입력창 아래 줄에 서는 칩. 편집기가 원본을 들고 바뀔 때마다 알려 준다. */
  const [chips, setChips] = useState<ScopeChip[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  // Escape 로 닫은 뒤에는 같은 `@` 로 다시 열지 않는다. 렌더가 읽는 값이라 ref 가 아니라 상태다.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [taken, setTaken] = useState<Set<string>>(new Set());

  const sections = useMemo(
    () =>
      scope && query !== null ? matchScope(scope.candidates, query, taken) : [],
    [scope, query, taken]
  );

  /**
   * 이 값이 곧 「Enter 는 누구 것인가」다. 맞는 것이 없는데 열려 있으면 Enter 를 삼키기만
   * 하므로 닫는다. 목록이 아직 안 왔으면(`isPending`) 열어 둔다 — 안 그러면 고르려던 Enter
   * 가 반쯤 쓴 문장을 보낸다.
   */
  const isPickerOpen =
    scope !== undefined &&
    query !== null &&
    dismissed !== query &&
    (sections.length > 0 || scope.isPending);

  const submit = useCallback(() => {
    if (isBusy) return;
    const draft = inputRef.current?.read();
    if (!draft || !draft.text) return;
    onSubmit(draft);
  }, [inputRef, isBusy, onSubmit]);

  /** 범위 줄이 설 때만 쓰는 줄 아래에 둘째 줄을 둔다. 고른 범위가 있거나 「회의록」 버튼을 보일 때다. */
  const showChipRow = chips.length > 0 || (scope !== undefined && !isStreaming);
  const sendButton = isStreaming ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8 shrink-0 rounded-full pointer-coarse:size-11"
            aria-label="중지"
            onClick={onStop}
          />
        }
      >
        <Square className="size-3 fill-current" />
      </TooltipTrigger>
      <TooltipContent side="top">답 그만 받기</TooltipContent>
    </Tooltip>
  ) : (
    <Button
      type="submit"
      size="icon"
      className="size-8 shrink-0 rounded-full pointer-coarse:size-11"
      aria-label="보내기"
      disabled={isBusy}
    >
      <ArrowUp className="size-4" />
    </Button>
  );

  return (
    <form
      // 좌우 20px 은 본문·기록 목록과 같은 선이다. 아래는 모바일 홈 막대(safe area)만큼 더 띄운다. `@container` 는 좁은
      // 폭에서 짧은 안내로 바꾸는 기준이다(뷰포트가 아니라 패널·레일 폭이 정한다).
      className="@container relative px-5 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {isPickerOpen && scope ? (
        <div className="absolute right-5 bottom-full left-5">
          <ScopePicker
            id={pickerId}
            query={query}
            sections={sections}
            isPending={scope.isPending}
            onActiveChange={setActiveOptionId}
            onPick={(candidate) => {
              // 스무 개를 다 붙인 뒤 서버에서 거절당하지 않게 상한에서 막고 이유를 말한다.
              if (taken.size >= MAX_SCOPE_ITEMS) {
                toast.error(
                  `범위는 ${MAX_SCOPE_ITEMS}개까지 붙일 수 있습니다.`
                );
                setQuery(null);
                return;
              }
              inputRef.current?.commitMention({
                kind: candidate.kind,
                id: candidate.id,
                title: candidate.title,
              });
              setQuery(null);
            }}
            onDismiss={() => {
              setDismissed(query);
              // 「회의록」 버튼이 넣고 아무것도 안 친 `@` 는 걷는다
              inputRef.current?.cancelMention();
            }}
          />
        </div>
      ) : null}

      {/* 모서리를 덜 굴린다. 여섯 줄까지 자라므로 `rounded-full` 도 아니다. 위는 쓰는 줄, 아래는 범위 줄과 보내기다 —
          범위가 입력창 위에 따로 서지 않아 범위가 없을 때 입력창 위가 비지 않는다. */}
      <div
        className="flex flex-col gap-1 rounded-block border border-[var(--el-hairline-strong)] bg-[var(--el-surface-card)] pt-1.5 pr-2 pb-2 pl-3.5 transition-colors focus-within:border-[var(--el-ink)]"
        onClick={(event) => {
          // 칩·버튼을 누른 것은 그쪽 일이다. 빈 곳을 누르면 쓰는 줄로 간다
          if ((event.target as HTMLElement).closest("button")) return;
          inputRef.current?.focus();
        }}
      >
        <div className="flex items-end gap-2">
          <MentionInput
            ref={inputRef}
            placeholder={placeholder}
            shortPlaceholder={shortPlaceholder}
            isPickerOpen={isPickerOpen}
            pickerId={pickerId}
            activeOptionId={activeOptionId}
            onQueryChange={(next) => {
              setDismissed((current) => (next === current ? current : null));
              setQuery(next);
              onMentioningChange?.(next !== null);
            }}
            onChipsChange={(next) => {
              const keys = next.map(scopeKey);
              // 같은 집합이면 참조를 유지한다. 매번 새 Set 이면 다시 그려지며 이 콜백이 또 불린다.
              setTaken((current) =>
                keys.length === current.size &&
                keys.every((k) => current.has(k))
                  ? current
                  : new Set(keys)
              );
              setChips(next);
              onChipsChange(next);
            }}
            onSubmit={submit}
          />
          {/* 범위 줄이 없으면(답 받는 중 · 범위 없음) 보내기·중지가 쓰는 줄 끝에 선다 — 빈 줄로 상자가 커지지 않게 */}
          {showChipRow ? null : sendButton}
        </div>
        {showChipRow ? (
          <div className="flex items-end gap-2">
            {/* 범위 줄. 고른 범위 칩이 제목 전체로 서고(말줄임 없음), 길면 줄을 넘겨 감싼다. 칩이 많아도 쓰는 줄이 밀려
              사라지지 않게 높이 상한 안에서 스크롤한다. */}
            <div
              data-testid="composer-chips"
              aria-label={chips.length > 0 ? "이번 질문의 범위" : undefined}
              role={chips.length > 0 ? "group" : undefined}
              className="flex max-h-24 min-w-0 flex-1 flex-wrap items-center gap-1.5 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
            >
              {chips.map((chip) => (
                <ComposerChip
                  key={scopeKey(chip)}
                  chip={chip}
                  onRemove={() => inputRef.current?.removeChip(chip)}
                />
              ))}
              {/* 답 받는 동안에는 숨긴다 — 그동안 보낼 수 없어 범위를 고를 일도 없다 */}
              {scope !== undefined && !isStreaming ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label="회의록·프로젝트 고르기"
                        onClick={() => inputRef.current?.startMention()}
                        className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-[var(--el-hairline-strong)] px-2.5 text-xs text-[var(--el-body)] outline-none transition-colors pointer-coarse:h-9 hover:bg-[var(--el-canvas-soft)] hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50"
                      />
                    }
                  >
                    <FileText
                      aria-hidden
                      className="size-3.5 shrink-0 text-[var(--el-scope-note)]"
                    />
                    회의록
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    회의록·프로젝트 고르기
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            {sendButton}
          </div>
        ) : null}
      </div>
      {footer}
    </form>
  );
}

/**
 * 범위 칩 하나. 제목을 자르지 않는다 — 길면 칩 안에서 줄을 바꾼다(사용자 지시: 범위가 무엇인지 끝까지 보여야 한다). ✕ 로 뗀다.
 */
function ComposerChip({
  chip,
  onRemove,
}: {
  chip: ScopeChip;
  onRemove: () => void;
}) {
  const Icon = chip.kind === "project" ? Folder : FileText;
  return (
    <span
      data-scope-chip={chip.kind}
      className={scopeChipClass(chip.kind, {
        extra: "mx-0 py-1 pr-1 pl-2",
      })}
    >
      <Icon aria-hidden className="size-3.5 shrink-0 self-start mt-[2px]" />
      <span data-chip-title>{chip.title}</span>
      <button
        type="button"
        aria-label={`${chip.title} 빼기`}
        onClick={onRemove}
        className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center self-start rounded-full opacity-70 outline-none hover:bg-black/5 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 pointer-coarse:size-8"
      >
        <X aria-hidden className="size-3" />
      </button>
    </span>
  );
}
