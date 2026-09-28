"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

import type { ScopeChip } from "@/lib/chat/scope-chip";
import { toast } from "@/lib/ui/toast";

// server 계약의 상한이다. 넘으면 400 이라 붙이기 전에 막는다.
const MAX_SCOPE_ITEMS = 20;
import { MentionInput, type MentionHandle } from "@/components/chat/mention-input";
import { ScopePicker } from "@/components/chat/scope-picker";
import { Button } from "@/components/ui/button";
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

  return (
    <form
      className="relative px-5 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {isPickerOpen && scope ? (
        <div className="absolute right-5 left-5">
          <ScopePicker
            query={query}
            sections={sections}
            isPending={scope.isPending}
            onPick={(candidate) => {
              // 스무 개를 다 붙인 뒤 서버에서 거절당하지 않게 상한에서 막고 이유를 말한다.
              if (taken.size >= MAX_SCOPE_ITEMS) {
                toast.error(`범위는 ${MAX_SCOPE_ITEMS}개까지 붙일 수 있습니다.`);
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
            onDismiss={() => setDismissed(query)}
          />
        </div>
      ) : null}

      {/* 모서리를 덜 굴린다. 50px 상자에 16px 이면 곧은 변이 거의 안 남고, 여섯 줄까지
          자라므로 `rounded-full` 도 아니다. */}
      <div
        className="flex items-end gap-2.5 rounded-block border border-[var(--el-hairline-strong)] bg-white px-3.5 py-3 transition-colors focus-within:border-[var(--el-ink)]"
        onClick={() => inputRef.current?.focus()}
      >
        <MentionInput
          ref={inputRef}
          placeholder={placeholder}
          isPickerOpen={isPickerOpen}
          onQueryChange={(next) => {
            setDismissed((current) => (next === current ? current : null));
            setQuery(next);
            onMentioningChange?.(next !== null);
          }}
          onChipsChange={(chips) => {
            const keys = chips.map((chip) => `${chip.kind}:${chip.id}`);
            // 같은 집합이면 참조를 유지한다. 매번 새 Set 이면 다시 그려지며 이 콜백이 또 불린다.
            setTaken((current) =>
              keys.length === current.size && keys.every((k) => current.has(k))
                ? current
                : new Set(keys)
            );
            onChipsChange(chips);
          }}
          onSubmit={submit}
        />
        {isStreaming ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-9 shrink-0 rounded-full"
            aria-label="중지"
            onClick={onStop}
          >
            <Square className="size-3.5" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="size-9 shrink-0 rounded-full"
            aria-label="보내기"
            disabled={isBusy}
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
      {footer}
    </form>
  );
}
