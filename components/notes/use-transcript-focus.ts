"use client";

import { useCallback, useEffect, useRef, type CSSProperties } from "react";

import type { TranscriptPresentationSegment } from "@/lib/transcription/presentation";

const PEN_MS_PER_EM = 6;

const SPAN_MAX_EM = 320;

const STROKE_MIN_MS = 120;

const STROKE_MAX_MS = 700;

const HOLD_MS = 1_000;

function penOf(text: string) {
  const spanEm = Math.min(SPAN_MAX_EM, text.length);
  return {
    spanEm,
    strokeMs: Math.min(
      STROKE_MAX_MS,
      Math.max(STROKE_MIN_MS, spanEm * PEN_MS_PER_EM)
    ),
  };
}

export const SCREEN_CHANGE_HOLD_MS = 2_200;

export function evidenceMarkOf(
  text: string,
  { holdMs = HOLD_MS }: { holdMs?: number } = {}
) {
  const { spanEm, strokeMs } = penOf(text);
  return {
    props: {
      className: "evidence-mark",
      style: {
        "--evidence-span": `${spanEm}em`,
        "--evidence-stroke": `${strokeMs}ms`,
        "--evidence-hold": `${holdMs}ms`,
      } as CSSProperties,
    },
    lifetimeMs: strokeMs * 2 + holdMs,
  };
}

export type TranscriptFocus = {
  focusSegmentId: string | null;
  onFocusHandled: () => void;
  focusDestination?: boolean;
};

export function useTranscriptFocus(
  segments: TranscriptPresentationSegment[],
  { focusSegmentId, onFocusHandled, focusDestination = true }: TranscriptFocus,
  scrollToSegment?: (segmentId: string) => void,
  requestKey = 0
) {
  const focusedSegment =
    segments.find((segment) => segment.segmentId === focusSegmentId) ?? null;
  const focusedSegmentId = focusedSegment?.segmentId ?? null;
  const { lifetimeMs } = evidenceMarkOf(focusedSegment?.text ?? "");
  const nodeRef = useRef<HTMLElement | null>(null);
  const scrollToSegmentRef = useRef(scrollToSegment);
  useEffect(() => {
    scrollToSegmentRef.current = scrollToSegment;
  }, [scrollToSegment]);

  useEffect(() => {
    if (!focusedSegmentId) return;
    const frame = requestAnimationFrame(() => {
      const node = nodeRef.current;
      if (!node) return;
      if (scrollToSegmentRef.current)
        scrollToSegmentRef.current(focusedSegmentId);
      else node.scrollIntoView?.({ block: "center" });
      if (focusDestination) node.focus?.({ preventScroll: true });
    });
    const timer = window.setTimeout(onFocusHandled, lifetimeMs);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [
    focusedSegmentId,
    lifetimeMs,
    onFocusHandled,
    requestKey,
    focusDestination,
  ]);

  const segmentRef = useCallback(
    (segmentId: string) =>
      segmentId === focusedSegmentId ? nodeRef : undefined,
    [focusedSegmentId]
  );
  const markProps = useCallback(
    (segmentId: string) =>
      segmentId === focusedSegmentId
        ? evidenceMarkOf(focusedSegment?.text ?? "").props
        : {},
    [focusedSegmentId, focusedSegment?.text]
  );
  const isHighlighted = useCallback(
    (segmentId: string) => segmentId === focusedSegmentId,
    [focusedSegmentId]
  );

  return {
    segmentRef,
    markProps,
    isHighlighted,
  };
}
