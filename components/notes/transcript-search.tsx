"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TranscriptPresentationSegment } from "@/lib/transcription/presentation";

export function TranscriptSearch({
  segments,
  onJump,
  children,
}: {
  segments: TranscriptPresentationSegment[];
  onJump: (id: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? segments.filter((s) => s.text.toLowerCase().includes(needle))
      : [];
  }, [query, segments]);
  const index = matches.findIndex((s) => s.segmentId === selected);
  const move = (direction: number) => {
    if (!matches.length) return;
    const next =
      index < 0
        ? direction > 0
          ? 0
          : matches.length - 1
        : (index + direction + matches.length) % matches.length;
    const id = matches[next].segmentId;
    setSelected(id);
    input.current?.focus({ preventScroll: true });
    onJump(id);
  };
  const close = () => {
    setOpen(false);
    setQuery("");
    setSelected(null);
    trigger.current?.focus({ preventScroll: true });
  };
  return (
    <div
      data-testid="transcript-tools"
      className="sticky top-0 z-10 -mt-5 bg-white pt-5"
    >
      <div className="flex flex-wrap items-center justify-end gap-1">
        <Button
          ref={trigger}
          variant="ghost"
          size="sm"
          disabled={!segments.length}
          aria-expanded={open}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <Search data-icon="inline-start" />
          검색
        </Button>
        {children}
      </div>
      {open ? (
        <div
          role="search"
          aria-label="전사 검색"
          className="mt-2 flex items-center gap-1 rounded-control border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-1.5"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
            if (
              event.key === "Enter" &&
              event.target === input.current &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              move(event.shiftKey ? -1 : 1);
            }
          }}
        >
          <Input
            ref={input}
            autoFocus
            aria-label="전사 검색어"
            placeholder="전사에서 검색"
            className="min-w-0 flex-1 border-0 bg-transparent shadow-none"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
            }}
          />
          <span
            role="status"
            className="shrink-0 whitespace-nowrap px-1 text-xs tabular-nums text-[var(--el-muted)]"
          >
            {query.trim()
              ? matches.length
                ? index < 0
                  ? `${matches.length}개`
                  : `${index + 1}/${matches.length}`
                : "결과 없음"
              : ""}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="이전 검색 결과"
            disabled={!matches.length}
            onClick={() => move(-1)}
          >
            <ChevronUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="다음 검색 결과"
            disabled={!matches.length}
            onClick={() => move(1)}
          >
            <ChevronDown />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="검색 닫기"
            onClick={close}
          >
            <X />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
