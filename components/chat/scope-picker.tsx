"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Folder } from "lucide-react";

import type {
  ScopeCandidate,
  ScopeSection,
} from "@/lib/chat/use-scope-catalog";
import { cn } from "@/lib/utils";

/**
 * `@` 피커.
 *
 * **캐럿이 아니라 컴포저에 붙인다.** 캐럿 좌표에 띄우려면 textarea 안의 글자 위치를 거울
 * div로 재야 하는데, 좁은 레일에서는 팝오버가 어차피 컴포저 폭을 다 쓴다 — 재서 얻는 것이
 * 없다. 넓은 화면에서 캐럿 추적이 아쉬워지면 그때 `VirtualElement`로 올린다.
 *
 * Base UI `Combobox`를 안 쓴다. 그건 자기 input을 갖는데 여기 입력은 **본문 textarea**이고
 * `@` 뒤 글자가 곧 질의다. 입력을 둘로 두면 포커스가 갈리고 IME 조합이 그 경계에서 깨진다.
 */
export function ScopePicker({
  query,
  sections,
  isPending,
  onPick,
  onDismiss,
}: {
  /** 겨눈 자리를 언제 맨 위로 되돌릴지 가르는 값. 목록을 거르는 것은 컴포저가 이미 했다. */
  query: string;
  /** 이미 걸러진 목록(`matchScope`). **비어 있으면 컴포저가 이걸 안 연다.** */
  sections: ScopeSection[];
  isPending: boolean;
  onPick: (candidate: ScopeCandidate) => void;
  onDismiss: () => void;
}) {
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  const listRef = useRef<HTMLDivElement | null>(null);

  /**
   * 겨눈 항목을 **렌더에서 접는다.** 효과로 되돌리면 한 프레임 동안 없는 항목을 겨누고,
   * 그 사이 Enter가 들어오면 엉뚱한 것이 붙는다. 커서가 어느 질의의 것인지 함께 들고
   * 있어서 질의가 바뀌면 저절로 맨 위로 돌아간다.
   */
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
   * 키는 편집기가 갖고 있다 — 여기서 포커스를 가져오면 IME 조합이 끊긴다. 그래서
   * document 캡처로 듣고, **먹은 키는 전파까지 끊는다.**
   *
   * `preventDefault`만으로는 모자랐다. 여기서 고르면 `onPick`이 부모 상태를 바꾸고,
   * React는 네이티브 리스너에서 시작된 discrete 갱신을 **그 자리에서 흘려보낸다.**
   * 그 결과 같은 Enter가 편집기의 React 핸들러에 닿을 때는 `isPickerOpen`이 이미
   * false이고, 편집기는 그것을 「피커가 없다」로 읽어 **방금 완성된 문장을 전송**했다.
   * 고르기와 전송이 한 번에 일어났다.
   *
   * 그래서 `isPickerOpen` prop에 기대지 않는다 — 먹은 키는 캡처 단계에서 멈춘다.
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
        // 목록이 아직 안 왔어도 먹는다. 안 그러면 조회가 늦은 몇백 ms 사이에
        // 고르려던 Enter가 반쯤 쓴 문장을 보낸다.
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
    // jsdom 에 없다. 스크롤은 곁다리라 없으면 그냥 안 한다.
    active?.scrollIntoView?.({ block: "nearest" });
  }, [cursor]);

  // 「맞는 것이 없습니다」 카드가 없다. 그 상태에서는 컴포저가 피커를 아예 안 열고
  // Enter 를 문장에 돌려준다 — 고를 것이 없는데 키만 먹히는 구간을 없앤 것이다.
  // 남는 빈 상태는 **목록이 아직 안 온 동안**뿐이다.
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
      <div
        ref={listRef}
        role="listbox"
        aria-label="범위에 더할 프로젝트·회의록"
        className="max-h-72 overflow-y-auto py-1.5"
      >
        {sections.map((section) => (
          <div key={section.label} role="group" aria-label={section.label}>
            <p className="px-3.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-[var(--el-muted)]">
              {section.label}
            </p>
            {section.items.map((item) => {
              // 겨눈 자리는 섹션을 가로지르는 번호다. 목록이 열세 줄이라 훑어 찾는다.
              const active = flat.indexOf(item) === cursor;
              const Icon = item.kind === "project" ? Folder : FileText;
              return (
                <button
                  key={`${item.kind}:${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-active={active ? "true" : undefined}
                  // mousedown 을 막아야 textarea 가 포커스를 안 잃는다 — 잃으면 조합 중이던
                  // 한글이 확정 없이 사라진다.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onPick(item)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[14px]",
                    active
                      ? "bg-[var(--el-surface-strong)] text-[var(--el-ink)]"
                      : "text-[var(--el-body)]"
                  )}
                >
                  {/* 목록에서도 같은 색으로 가른다 — 칩이 될 때 색이 안 바뀌어야
                      「이걸 골랐다」가 이어진다. */}
                  <Icon
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0",
                      item.kind === "project"
                        ? "text-[var(--el-scope-project)]"
                        : "text-[var(--el-scope-note)]"
                    )}
                  />
                  <span className="truncate">{item.title}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="scope-picker"
      className="absolute right-0 bottom-full left-0 z-20 mb-1.5 rounded-panel border border-[var(--el-hairline)] bg-white shadow-e2"
    >
      {children}
    </div>
  );
}
