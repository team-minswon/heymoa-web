"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

import type { ScopeChip } from "@/lib/chat/scope-chip";
import { toast } from "@/lib/ui/toast";

/**
 * 한 턴에 붙일 수 있는 범위 수. **server 계약이 정한 값이다** — 넘으면 400이다.
 * 여기서 같은 값을 세는 것은 거절을 막기 위해서지 규칙을 새로 만드는 것이 아니다.
 */
const MAX_SCOPE_ITEMS = 20;
import { MentionInput, type MentionHandle } from "@/components/chat/mention-input";
import { ScopePicker } from "@/components/chat/scope-picker";
import { Button } from "@/components/ui/button";
import { matchScope, type ScopeCandidate } from "@/lib/chat/use-scope-catalog";

/**
 * 개인 챗봇 입력부.
 *
 * **칩은 문장 안에 삽니다** — `@`를 친 자리에 그대로 박힙니다. 편집기 자체는
 * `MentionInput`이 갖고 여기는 그 둘레(피커·보내기·안내)를 답니다.
 *
 * ### 답변이 흐르는 동안
 *
 * **입력을 막지 않습니다.** 답을 읽으면서 다음 질문을 적어 두는 것이 자연스럽고, 막으면
 * 그 사이 떠오른 문장을 다른 데 적어야 합니다. 막는 것은 **전송뿐**입니다 — 앞 턴이
 * 끝나기 전에 보내면 그 스트림이 끊기고 계약상 부분 응답은 저장되지 않습니다.
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
  /** 보낼 수 없는 상태. **입력은 그대로 열려 있다.** */
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
  /** `@` 를 치기 시작했다. 부모가 이때 목록을 받아 온다 — 채팅을 열기만 해도 도는 것은 낭비다. */
  onMentioningChange?: (mentioning: boolean) => void;
}) {
  const [query, setQuery] = useState<string | null>(null);
  // 사용자가 Escape 로 닫은 뒤에는 같은 `@` 로 다시 열지 않는다. 렌더가 이 값을 읽으므로
  // ref 가 아니라 상태다 — ref 로 두면 닫힌 것이 다음 렌더에서야 반영된다.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [taken, setTaken] = useState<Set<string>>(new Set());

  const sections = useMemo(
    () =>
      scope && query !== null ? matchScope(scope.candidates, query, taken) : [],
    [scope, query, taken]
  );

  /**
   * **고를 것이 있을 때만 연다.**
   *
   * 이 값이 곧 「Enter 는 누구 것인가」다. 열려 있으면 Enter 가 목록에서 고르고, 닫혀
   * 있으면 문장을 보낸다. 그래서 *맞는 것이 없는데 열려 있는* 상태를 두지 않는다 —
   * 그건 Enter 를 삼키기만 하고 아무것도 안 하는 구간이다.
   *
   * 반대쪽도 같은 이유로 막는다. 목록이 아직 안 왔으면(`isPending`) 곧 채워질 자리라
   * 열어 두고 Enter 를 잡는다. 안 그러면 조회가 늦은 그 몇백 ms 동안 고르려던 Enter 가
   * 반쯤 쓴 문장을 보낸다.
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
              // **상한에 닿으면 안 박고 이유를 말한다.** 서버가 20을 넘으면 400으로
              // 막는데, 여기서 안 세면 사용자는 스무 개를 다 붙인 뒤에야 그것을 알고
              // 무엇을 빼야 할지도 모른 채 거절당한다.
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

      {/* 상자 하나가 곧 이번 요청이다 — 칩도 본문도 이 안에 있다.

          **모서리를 덜 굴린다.** 16px 은 50px 짜리 상자에서 위아래 곡선이 높이의 3분의 1을
          먹어 곧은 변이 거의 안 남는다 — 알약이 되다 만 것처럼 찌그러져 보인다.
          상자가 여섯 줄까지 자라므로 완전한 알약(`rounded-full`)도 답이 아니다. */}
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
            // 같은 집합이면 새 Set 을 세우지 않는다 — 매번 새 참조를 주면 이 컴포넌트가
            // 스스로를 다시 그리고 그 렌더가 또 이 콜백을 부른다.
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
