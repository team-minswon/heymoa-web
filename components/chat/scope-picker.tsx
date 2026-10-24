"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Folder } from "lucide-react";

import { viewerDateKey } from "@/lib/format/date";
import type {
  ScopeCandidate,
  ScopeSection,
} from "@/lib/chat/use-scope-catalog";
import { cn } from "@/lib/utils";

/**
 * `@` 피커. 캐럿이 아니라 컴포저에 붙인다 — 좁은 레일에서는 어차피 컴포저 폭을 다 쓴다.
 *
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
  /** 목록 상자의 id. 편집기가 `aria-controls` 로 가리킨다. 항목 id 는 여기에 순번을 붙인다. */
  id: string;
  /** 겨눈 자리를 언제 맨 위로 되돌릴지 가르는 값. 목록을 거르는 것은 컴포저가 이미 했다. */
  query: string;
  /** 이미 걸러진 목록(`matchScope`). 비어 있으면 컴포저가 이걸 안 연다. */
  sections: ScopeSection[];
  isPending: boolean;
  onPick: (candidate: ScopeCandidate) => void;
  onDismiss: () => void;
  /** 겨눈 항목의 id. 포커스는 편집기에 남으므로 편집기가 `aria-activedescendant` 로 알린다. */
  onActiveChange?: (optionId: string | null) => void;
}) {
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  const listRef = useRef<HTMLDivElement | null>(null);

  // 겨눈 항목을 렌더에서 접는다. 효과로 되돌리면 한 프레임 동안 없는 항목을 겨누고, 그 사이
  // Enter 가 들어오면 엉뚱한 것이 붙는다. 질의가 바뀌면 저절로 맨 위로 간다.
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
        // 목록이 아직 안 왔어도 먹는다. 안 그러면 고르려던 Enter 가 반쯤 쓴 문장을 보낸다.
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
    // jsdom 에는 `scrollIntoView` 가 없다.
    active?.scrollIntoView?.({ block: "nearest" });
  }, [cursor]);

  const activeId = flat.length > 0 ? `${id}-${cursor}` : null;
  useEffect(() => {
    onActiveChange?.(activeId);
  }, [activeId, onActiveChange]);
  useEffect(() => () => onActiveChange?.(null), [onActiveChange]);

  // 맞는 것이 없으면 컴포저가 피커를 안 연다. 남는 빈 상태는 목록이 아직 안 온 동안뿐이다.
  if (flat.length === 0) {
    return isPending ? (
      <Shell>
        <p className="px-3.5 py-2.5 text-[13px] text-[var(--el-muted)]">
          불러오는 중…
        </p>
      </Shell>
    ) : null;
  }

  return (
    <Shell>
      {/* 높이는 약 여섯 줄까지다. 그 이상은 안에서 스크롤하고 막대는 가리킬 때만 보인다 — 메시지를 크게 덮지 않는다. */}
      <div
        ref={listRef}
        id={id}
        role="listbox"
        aria-label="범위에 더할 프로젝트·회의록"
        className="max-h-[min(15rem,40vh)] overflow-y-auto overscroll-contain px-1.5 py-1 [scrollbar-color:transparent_transparent] [scrollbar-width:thin] hover:[scrollbar-color:var(--el-hairline-strong)_transparent]"
      >
        {sections.map((section) => (
          <div key={section.label} role="group" aria-label={section.label}>
            <p
              aria-hidden
              className="px-2 pt-2 pb-1 text-[11.5px] font-medium text-[var(--el-muted)]"
            >
              {section.label}
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
                  {/* 칩과 같은 색으로 가른다. */}
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
        ↑↓ 이동 · Enter 선택 · Esc 닫기 · 계속 입력하면 좁혀져요
      </p>
    </Shell>
  );
}

/** 「10/24」. 보는 사람의 날짜로 센다. */
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
