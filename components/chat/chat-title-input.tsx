"use client";

import { useEffect, useRef } from "react";

import {
  MAX_CHAT_TITLE_LENGTH,
  normalizeChatTitle,
} from "@/lib/chat/rename-chat";
import { cn } from "@/lib/utils";

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
