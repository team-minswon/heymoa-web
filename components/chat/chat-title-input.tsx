"use client";

import { useEffect, useRef } from "react";

import {
  MAX_CHAT_TITLE_LENGTH,
  normalizeChatTitle,
} from "@/lib/chat/rename-chat";
import { cn } from "@/lib/utils";

/**
 * 대화 제목 그 자리 편집. Enter·바깥 클릭은 저장, Esc 는 취소. 비었거나 그대로면 저장하지 않는다.
 *
 * 값은 처음 한 번만 받는다(`defaultValue`) — 편집 중에 AI·다른 탭의 제목이 도착해도 쓰던 글자를 덮지 않는다.
 *
 * 끝나면 입력이 사라진다. 그 자리로 포커스를 돌려줄지(`restoreFocus`)는 끝난 방식이 정한다 — Enter·Esc 는 늘,
 * blur 는 포커스가 갈 곳 없이 빠졌을 때만이다. 다른 버튼을 눌러 빠졌으면 그 버튼에서 뺏지 않는다.
 */
export function ChatTitleInput({
  initial,
  label,
  onSubmit,
  onDone,
  className,
}: {
  initial: string;
  label: string;
  onSubmit: (title: string) => void;
  onDone: (restoreFocus: boolean) => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // Enter 로 끝낸 뒤 사라지며 나는 blur 가 한 번 더 저장하지 않게
  const finished = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const finish = (value: string | null, restoreFocus: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const title = value === null ? null : normalizeChatTitle(value);
    if (title && title !== initial) onSubmit(title);
    onDone(restoreFocus);
  };

  return (
    <input
      ref={ref}
      aria-label={label}
      defaultValue={initial}
      maxLength={MAX_CHAT_TITLE_LENGTH}
      onKeyDown={(event) => {
        // 한글 조합 중 Enter 는 글자를 확정할 뿐이다
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === "Enter") {
          event.preventDefault();
          finish(event.currentTarget.value, true);
        } else if (event.key === "Escape") {
          // 패널·대화상자의 Esc 로 번지지 않게
          event.preventDefault();
          event.stopPropagation();
          finish(null, true);
        }
      }}
      onBlur={(event) =>
        finish(event.currentTarget.value, event.relatedTarget === null)
      }
      className={cn(
        "w-full min-w-0 rounded-block border border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-2 py-1 text-sm text-[var(--el-ink)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    />
  );
}
