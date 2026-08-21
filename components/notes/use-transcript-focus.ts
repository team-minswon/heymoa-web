"use client";

import { useCallback, useEffect, useRef } from "react";

import type { TranscriptPresentationSegment } from "@/lib/transcription/presentation";

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
 * **세그먼트를 그대로 찾는다.** 묶기가 있던 동안에는 세그먼트 최대 6개가 한 `<article>`이라
 * 중간 세그먼트를 가리키는 DOM 노드가 없었고, 그 세그먼트를 품은 블록을 되찾아 앵커를 달아야
 * 했다. 이제 행이 곧 세그먼트라 그 우회가 사라진다 — 짚는 자리가 정확히 인용된 발화다.
 *
 * **타임스탬프로 찾지 않는다.** 근거는 `segmentId`로 온다. 좌표로 맞추면 같은 순간에 걸친
 * 발화들 사이에서 어느 것인지 못 가른다(APP-398).
 */
export function useTranscriptFocus(
  segments: TranscriptPresentationSegment[],
  { focusSegmentId, onFocusHandled }: TranscriptFocus
) {
  const focusedSegmentId =
    segments.find((segment) => segment.segmentId === focusSegmentId)
      ?.segmentId ?? null;
  const nodeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // 아직 그 세그먼트가 없다 — 전사가 로딩 중이면 도착한 뒤 다시 돈다.
    if (!focusedSegmentId) return;
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
  }, [focusedSegmentId, onFocusHandled]);

  const segmentRef = useCallback(
    (segmentId: string) =>
      segmentId === focusedSegmentId ? nodeRef : undefined,
    [focusedSegmentId]
  );

  return {
    /** 점프 대상 발화의 `<article>`에만 붙는다. */
    segmentRef,
    /**
     * 하이라이트는 **파생값이다.** 지역 상태로 따로 들고 있으면 소유자의 `focusSegmentId`와
     * 두 개의 진실이 되고, 끄는 타이밍을 양쪽에서 맞춰야 한다. 위 타이머가 소유자에게
     * 비우라고 알리면 여기도 함께 꺼진다.
     */
    isHighlighted: (segmentId: string) => segmentId === focusedSegmentId,
  };
}

/**
 * 짚힌 줄의 공통 표기. 두 전사 화면이 같은 자리를 같은 모양으로 짚는다.
 *
 * **형광펜은 글자에만 칠한다.** 행 배경을 통째로 칠하면 시각 열까지 노랗게 물든 띠가
 * 되어 편집면에서 너무 튀었다. 인라인 span에 얹으면 글자 line box만 덮여서 종이에 펜을
 * 그은 모양이 된다 — 어느 줄인지는 그것으로 충분히 보인다.
 *
 * **여백은 건드리지 않는다.** 예전에는 행에 `px-3`이 함께 붙어서, 짚히는 순간 그 행만
 * 글자가 12px 밀리고 아래 hairline이 24px 짧아졌다 — 찾아간 줄이 도착과 동시에 움직이는
 * 셈이다. 인라인 span의 `px-*`도 첫 글자를 밀기 때문에 같이 쓰지 않는다.
 *
 * `box-decoration-clone`이 필요하다 — 두 줄 이상으로 감기는 발화에서 기본값(`slice`)은
 * 배경을 한 덩어리로 잘라 줄 사이가 비어 보인다.
 */
export const FOCUSED_TEXT_CLASS =
  "rounded-chip box-decoration-clone bg-[var(--el-highlight)] transition-colors";
