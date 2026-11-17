"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Folder } from "lucide-react";
import { useTranslations } from "next-intl";

import { viewerDateKey } from "@/lib/format/date";
import type {
  ScopeCandidate,
  ScopeSection,
} from "@/lib/chat/use-scope-catalog";
import { cn } from "@/lib/utils";

/**
 * Base UI `Combobox` 는 자기 input 을 가져서 안 쓴다. 입력은 본문 편집기이고 `@` 뒤 글자가
 * 곧 질의다. 입력이 둘이면 포커스가 갈리고 IME 조합이 그 경계에서 깨진다.
 */
export function ScopePicker({
  id,
  query,
  sections,
  isPending,
  onPick,
  onDismiss,
  onActiveChange,
}: {
  id: string;
  query: string;
  sections: ScopeSection[];
  isPending: boolean;
  onPick: (candidate: ScopeCandidate) => void;
  onDismiss: () => void;
  onActiveChange?: (optionId: string | null) => void;
}) {
  const t = useTranslations("chat.picker");
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  const listRef = useRef<HTMLDivElement | null>(null);

  const [mark, setMark] = useState({ query, index: 0 });
  const cursor =
    mark.query === query && flat.length > 0
      ? Math.min(mark.index, flat.length - 1)
      : 0;
  const moveCursor = useCallback(
    (next: (from: number) => number) =>
      setMark((current) => ({
        query,
        index: current.query === query ? next(current.index) : next(0),
      })),
    [query]
  );

  /**
   * 키는 편집기가 갖고 있다(포커스를 가져오면 IME 조합이 끊긴다). 그래서 document 캡처로
   * 듣고 먹은 키는 전파까지 끊는다.
   *
   * `preventDefault` 만으로는 모자라다. 고르면 `onPick` 이 부모 상태를 바꾸고 React 가 그
   * 갱신을 그 자리에서 흘려보내서, 같은 Enter 가 편집기에 닿을 때 `isPickerOpen` 이 이미
   * false 라 문장이 전송된다.
   */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // 조합 중 Enter는 IME의 확정 키다. 가로채면 쓰던 글자가 사라진다.
      if (event.isComposing) return;
      const consume = () => {
        event.preventDefault();
        event.stopPropagation();
      };
      if (event.key === "ArrowDown") {
        consume();
        moveCursor((value) => (value + 1) % Math.max(1, flat.length));
      } else if (event.key === "ArrowUp") {
        consume();
        moveCursor(
          (value) => (value - 1 + flat.length) % Math.max(1, flat.length)
        );
      } else if (event.key === "Enter" || event.key === "Tab") {
        consume();
        if (flat[cursor]) onPick(flat[cursor]);
      } else if (event.key === "Escape") {
        consume();
        onDismiss();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [cursor, flat, moveCursor, onDismiss, onPick]);

  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView?.({ block: "nearest" });
  }, [cursor]);

  const activeId = flat.length > 0 ? `${id}-${cursor}` : null;
  useEffect(() => {
    onActiveChange?.(activeId);
  }, [activeId, onActiveChange]);
  useEffect(() => () => onActiveChange?.(null), [onActiveChange]);

  if (flat.length === 0) {
    return isPending ? (
      <Shell>
        <p className="px-3.5 py-2.5 text-[13px] text-[var(--el-muted)]">
          {t("loading")}
        </p>
      </Shell>
    ) : null;
  }

  return (
    <Shell>
      <div
        ref={listRef}
        id={id}
        role="listbox"
        aria-label={t("label")}
        className="max-h-[min(15rem,40vh)] overflow-y-auto overscroll-contain px-1.5 py-1 [scrollbar-color:transparent_transparent] [scrollbar-width:thin] hover:[scrollbar-color:var(--el-hairline-strong)_transparent]"
      >
        {sections.map((section) => (
          <div
            key={section.kind}
            role="group"
            aria-label={t(section.kind === "project" ? "projects" : "notes")}
          >
            <p
              aria-hidden
              className="px-2 pt-2 pb-1 text-[11.5px] font-medium text-[var(--el-muted)]"
            >
              {t(section.kind === "project" ? "projects" : "notes")}
            </p>
            {section.items.map((item) => {
              const index = flat.indexOf(item);
              const active = index === cursor;
              const Icon = item.kind === "project" ? Folder : FileText;
              return (
                <div
                  key={`${item.kind}:${item.id}`}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={active}
                  data-active={active ? "true" : undefined}
                  // mousedown 을 막아야 편집기가 포커스를 안 잃는다. 잃으면 조합 중이던 한글이
                  // 확정 없이 사라진다.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => {
                    if (!active) moveCursor(() => index);
                  }}
                  onClick={() => onPick(item)}
                  className={cn(
                    "flex h-9 cursor-pointer items-center gap-2.5 rounded-control px-2 text-[13.5px] pointer-coarse:h-11",
                    active
                      ? "bg-[var(--el-surface-strong)] text-[var(--el-ink)]"
                      : "text-[var(--el-body)]"
                  )}
                >
                  <Icon
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0",
                      item.kind === "project"
                        ? "text-[var(--el-scope-project)]"
                        : "text-[var(--el-scope-note)]"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {item.at ? (
                    <span className="shrink-0 text-xs text-[var(--el-muted)] tabular-nums">
                      {shortDate(item.at)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p
        aria-hidden
        className="border-t border-[var(--el-hairline)] px-3.5 py-1.5 text-[11.5px] text-[var(--el-muted)] pointer-coarse:hidden"
      >
        {t("hint")}
      </p>
    </Shell>
  );
}

function shortDate(at: string) {
  const [, month, day] = viewerDateKey(at).split("-");
  return `${Number(month)}/${Number(day)}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="scope-picker"
      className="absolute right-0 bottom-full left-0 z-20 mb-2 overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-[var(--el-surface-card)] shadow-e2 chat-rise"
    >
      {children}
    </div>
  );
}
