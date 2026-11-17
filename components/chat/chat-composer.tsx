"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ScopeChip } from "@/lib/chat/scope-chip";
import { toast } from "@/lib/ui/toast";

const MAX_SCOPE_ITEMS = 20;
import {
  MentionInput,
  type MentionHandle,
} from "@/components/chat/mention-input";
import { ScopePicker } from "@/components/chat/scope-picker";
import { Button } from "@/components/ui/button";
import { matchScope, type ScopeCandidate } from "@/lib/chat/use-scope-catalog";

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
  onSubmit: (draft: { text: string; chips: ScopeChip[] }) => void;
  onStop: () => void;
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
  onMentioningChange?: (mentioning: boolean) => void;
}) {
  const t = useTranslations("chat.composer");
  const pickerId = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [taken, setTaken] = useState<Set<string>>(new Set());

  const sections = useMemo(
    () =>
      scope && query !== null ? matchScope(scope.candidates, query, taken) : [],
    [scope, query, taken]
  );

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
            id={pickerId}
            query={query}
            sections={sections}
            isPending={scope.isPending}
            onPick={(candidate) => {
              if (taken.size >= MAX_SCOPE_ITEMS) {
                toast.error(t("scopeLimit", { max: MAX_SCOPE_ITEMS }));
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
            aria-label={t("stop")}
            onClick={onStop}
          >
            <Square className="size-3.5" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="size-9 shrink-0 rounded-full"
            aria-label={t("send")}
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
