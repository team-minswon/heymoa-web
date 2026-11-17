"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { RefChips } from "./app";
import { APP, FOCUS } from "./tokens";

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
  const t = useTranslations("landing.app");
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
        <span className={cn("text-[12px]", APP.muted)}>{t("refsCount", { count: refs.length })}</span>
      </button>
      <div id={id} hidden={!shown} className={shown ? "chat-rise" : undefined}>
        <RefChips refs={refs} />
      </div>
    </div>
  );
}
