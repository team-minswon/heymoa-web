"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { RefChips } from "./app";
import { APP, FOCUS } from "./tokens";

/*
 * 앱 화면 조각 중 **진짜로 눌리는 것.** 창 안 = `--el-*` · `APP`, 창 밖 · 창 위 주석 = `--tv-*`.
 * 포커스 링만 페이지의 것(`FOCUS`)이다 — 링은 창 위에 얹는 주석이라 앱 화면으로 오인되지 않는다.
 */

/**
 * 「참고한 회의록 N개」 펼치기(`chain-of-thought.tsx` `AnswerRefs`). 앱 규칙대로 하나면 펴 두고 여럿이면
 * 접어 둔다. `open` 을 주면 제어 모드다(물어보기의 커서 장면이 연다) — 누르면 `onOpenChange` 만 부른다.
 * 칩은 갈 곳이 없어 그림(`span`)이다.
 */
export function AnswerRefs({
  refs,
  open,
  defaultOpen = refs.length === 1,
  onOpenChange,
  className,
}: {
  refs: string[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (next: boolean) => void;
  className?: string;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const id = useId();
  const shown = open ?? own;
  if (refs.length === 0) return null;

  return (
    <div className={cn("mt-2 border-t pt-2", APP.line, className)}>
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={id}
        onClick={() => {
          if (open === undefined) setOwn(!shown);
          onOpenChange?.(!shown);
        }}
        className={cn(
          "-ml-1 flex min-h-7 cursor-pointer items-center gap-1.5 rounded-[6px] pr-1 text-left",
          FOCUS
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 transition-transform motion-reduce:transition-none",
            APP.muted,
            shown && "rotate-90"
          )}
        />
        <span className={cn("text-[12px]", APP.muted)}>참고한 회의록 {refs.length}개</span>
      </button>
      <div id={id} hidden={!shown} className={shown ? "chat-rise" : undefined}>
        <RefChips refs={refs} />
      </div>
    </div>
  );
}
