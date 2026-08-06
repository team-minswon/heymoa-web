"use client";

import { useCallback, useEffect, useRef } from "react";

import type { TranscriptBlock } from "@/lib/transcription/presentation";

/**
 * 하이라이트가 남아 있는 시간. 지나면 소유자에게 focus를 비우라고 알린다 —
 * **안 비우면 전사 탭을 다시 열 때마다 같은 자리로 끌려간다.**
 */
const HIGHLIGHT_MS = 2_400;

export type TranscriptFocus = {
  /** 요약의 근거 인용이 가리키는 세그먼트. 없으면 null. */
  focusSegmentId: string | null;
  /** 하이라이트가 끝났다. 소유자가 `focusSegmentId`를 비운다. */
  onFocusHandled: () => void;
};

/**
 * 근거 인용 → 전사 점프. 전사 화면이 둘이라(진행 중 `TranscriptView`, 종료 뒤 `NoteArchive`)
 * 스크롤 엔진은 각자 갖되 이 앵커 로직만 공유한다.
 *
 * **세그먼트가 아니라 블록을 찾는다.** `groupTranscriptSegments`가 세그먼트를 최대 6개씩
 * 묶어 하나의 `<article>`로 내고 `blockId`는 그 블록 첫 세그먼트의 id라, 중간 세그먼트를
 * 가리키는 DOM 노드가 아예 없다. `segmentIds.includes()`로 그 세그먼트를 품은 블록을 찾아
 * 거기에 앵커를 단다 — 블록 안 몇 번째 줄인지는 표시하지 않는다.
 *
 * **타임스탬프로 찾지 않는다.** 근거의 `startedAtMs`는 세션별 오프셋이고 화면이 그리는 것은
 * 세션을 이어 붙인 `timelineStartedAtMs`라, 세션이 둘 이상인 노트에서 둘이 어긋난다(APP-398).
 */
export function useTranscriptFocus(
  blocks: TranscriptBlock[],
  { focusSegmentId, onFocusHandled }: TranscriptFocus
) {
  const focusedBlockId =
    blocks.find((block) => block.segmentIds.includes(focusSegmentId ?? ""))
      ?.blockId ?? null;
  const nodeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // 아직 그 세그먼트를 품은 블록이 없다 — 전사가 로딩 중이면 도착한 뒤 다시 돈다.
    if (!focusedBlockId) return;
    // 다음 프레임에 옮긴다 — 탭을 막 바꾼 참이라 목록이 아직 자라는 중이고, 진행 중 회의는
    // 같은 커밋에서 자동 스크롤이 바닥으로 한 번 내린다. 그 뒤에 서야 이 위치가 남는다.
    // (내려간 뒤 여기로 오면 `TranscriptView`의 scroll 핸들러가 추종을 알아서 끈다.)
    const frame = requestAnimationFrame(() => {
      nodeRef.current?.scrollIntoView?.({ block: "center" });
    });
    const timer = window.setTimeout(onFocusHandled, HIGHLIGHT_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focusedBlockId, onFocusHandled]);

  const blockRef = useCallback(
    (blockId: string) => (blockId === focusedBlockId ? nodeRef : undefined),
    [focusedBlockId]
  );

  return {
    /** 점프 대상 블록의 `<article>`에만 붙는다. */
    blockRef,
    /**
     * 하이라이트는 **파생값이다.** 지역 상태로 따로 들고 있으면 소유자의 `focusSegmentId`와
     * 두 개의 진실이 되고, 끄는 타이밍을 양쪽에서 맞춰야 한다. 위 타이머가 소유자에게
     * 비우라고 알리면 여기도 함께 꺼진다.
     */
    isHighlighted: (blockId: string) => blockId === focusedBlockId,
  };
}

/** 하이라이트된 블록의 공통 표기. 두 전사 화면이 같은 자리를 같은 모양으로 짚는다. */
export const FOCUSED_BLOCK_CLASS =
  "rounded-block bg-[var(--el-surface-strong)] px-3 transition-colors";
