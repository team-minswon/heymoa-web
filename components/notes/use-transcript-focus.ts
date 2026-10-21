"use client";

import { useCallback, useEffect, useRef, type CSSProperties } from "react";

import type { TranscriptPresentationSegment } from "@/lib/transcription/presentation";

/**
 * 형광펜이 **1em(한글 한 글자)을 긋는 데 걸리는 시간.** 시간이 아니라 속도를 고정한다 —
 * 어느 줄이든 같은 시간에 그으면 긴 발화에서는 펜이 몇 배 빨리 지나가고 짧은 발화에서는
 * 기어가서, 같은 표시가 줄마다 다른 물건으로 보인다.
 *
 * `ponytail:` 폭을 재지 않고 글자 수로 근사한다. 한글은 글자당 폭이 거의 1em이라 잘 맞지만
 * 라틴 문자는 좁아서 같은 글자 수로도 더 짧게 그어진다 — 눈에 띄면 그때 `getClientRects()`
 * 로 실제 폭을 재서 `--evidence-span`에 실어 준다.
 */
const PEN_MS_PER_EM = 6;

/**
 * 펜이 지나갈 길이의 상한(em). 여러 줄 발화는 줄들을 이어 붙인 한 줄 띠로 칠해지므로(`globals.css`의
 * `.evidence-mark`, `box-decoration-break: slice`) **발화 전체 글자 수만큼**이 필요하다. 이 값이
 * 모자라면 긴 발화의 뒷줄이 안 칠해진다.
 */
const SPAN_MAX_EM = 320;

/** 아주 짧은 맞장구("네.")도 획으로 보여야 한다. 이보다 빠르면 그냥 켜졌다 꺼진다. */
const STROKE_MIN_MS = 120;

/**
 * 한 번 긋는 데 걸리는 시간의 상한. 긴 발화도 한 호흡에 그어져야 한다 — 예전에는 560ms 를 선형으로
 * 천천히 지나가서, ◀ ▶ 로 발화를 넘길 때마다 펜이 따라오지 못하고 느리게 느껴졌다. 랜딩의 형광펜
 * (`tv-mark`, 0.6초 ease-out)과 같은 호흡이다.
 */
const STROKE_MAX_MS = 700;

/** 다 그은 뒤 머무는 시간. 읽을 시간이라 길이와 무관하게 같다. */
const HOLD_MS = 1_000;

/** 펜이 지나갈 길이(em)와 그 시간(ms). 획·지우개·수명이 전부 이 둘에서 나온다. */
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

/**
 * **화면이 바뀌는 이동**(다른 노트로 넘어온 이어짐, 요약 → 타임라인 탭 전환)에서 머무는 시간.
 * 근거 점프의 1초는 같은 탭 안에서 눈이 이미 그 자리를 따라갈 때의 값이다. 화면이 통째로 바뀌면
 * 새 화면을 훑어 표시를 찾는 데 먼저 시간이 들어 1초 남짓이면 찾기 전에 지워진다(APP-1290 e2e
 * 에서 획 전체 수명이 약 1.2초였다). 긋기 · 지우기를 더해 제목 길이의 표시가 약 2.5초 남게 한다.
 */
export const SCREEN_CHANGE_HOLD_MS = 2_200;

/**
 * 형광펜 한 획(긋기 · 머물기 · 지우기)의 모습과 수명. 전사의 근거 점프와 요약 · 타임라인의 안건
 * 점프(APP-1290)가 같은 펜을 쓴다 — 각자 조립하면 한쪽만 고쳤을 때 같은 표시가 화면마다 다르게
 * 움직인다. 머무는 시간만 이동의 종류에 따라 다르다(`SCREEN_CHANGE_HOLD_MS`).
 */
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
  /** 요약의 근거 인용이 가리키는 세그먼트. 없으면 null. */
  focusSegmentId: string | null;
  /** 하이라이트가 끝났다. 소유자가 `focusSegmentId`를 비운다. */
  onFocusHandled: () => void;
  /** 검색 결과 이동은 입력창의 키보드 포커스를 유지한다. */
  focusDestination?: boolean;
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
    // 아직 그 세그먼트가 없다 — 전사가 로딩 중이면 도착한 뒤 다시 돈다.
    if (!focusedSegmentId) return;
    // 다음 프레임에 옮긴다 — 탭을 막 바꾼 참이라 목록이 아직 자라는 중이고, 진행 중 회의는
    // 같은 커밋에서 자동 스크롤이 바닥으로 한 번 내린다. 그 뒤에 서야 이 위치가 남는다.
    // (내려간 뒤 여기로 오면 `TranscriptView`의 scroll 핸들러가 추종을 알아서 끈다.)
    const frame = requestAnimationFrame(() => {
      const node = nodeRef.current;
      if (!node) return;
      if (scrollToSegmentRef.current)
        scrollToSegmentRef.current(focusedSegmentId);
      else node.scrollIntoView?.({ block: "center" });
      /**
       * **눈으로 하는 일을 키보드·스크린리더에도 해 준다.** 형광은 칠일 뿐이라, 각주를 눌러
       * 준 인용 버튼이 탭과 함께 사라지면 포커스는 `<body>`로 떨어졌다 — 보지 않는 사람에게
       * 이 점프는 「화면만 바뀌고 아무 일도 안 일어난 것」이었다. 도착한 발화를 포커스로
       * 잡으면 그 줄이 읽히고 다음 Tab도 거기서 이어진다.
       *
       * 테두리는 브라우저의 `:focus-visible` 판정에 맡긴다 — 마우스로 눌러 온 사람에게는
       * 안 뜨고 키보드로 온 사람에게만 뜬다. 스크롤은 위에서 이미 맞췄으므로 막는다.
       */
      if (focusDestination) node.focus?.({ preventScroll: true });
    });
    // **획이 다 지워지는 순간에 비운다.** 안 비우면 전사 탭을 다시 열 때마다 같은 자리로
    // 끌려간다. 긋기·머물기·지우기의 합이 곧 이 표시의 수명이고, 그 값을 `.evidence-mark`
    // 에도 그대로 실어 보내므로(`markProps`) 두 시계가 갈라질 수 없다.
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
    /** 점프 대상 발화의 `<article>`에만 붙는다. */
    segmentRef,
    /**
     * 짚힌 발화의 글자를 감싼 span에 그대로 편다. 형광의 생김새와 획을 긋는 일은 전부
     * `globals.css`의 `.evidence-mark`에 있고 — 유틸리티 대여섯 개
     * (`bg-[image:…]`·`bg-[length:…]`·`bg-[position:…]`…)로 흩어 놓으면 무엇이 정적인
     * 모습이고 무엇이 애니메이션의 종점인지 읽을 수가 없다 — 여기서는 그 애니메이션이
     * 쓸 길이와 시간만 실어 보낸다. 두 전사 화면이 각자 조립하면 한쪽만 고쳤을 때 같은
     * 표시가 두 화면에서 다르게 움직인다.
     *
     * 짚히지 않은 줄에는 **아무것도 얹지 않는다** — 빈 `style`이라도 내주면 전사의 모든
     * 행이 인라인 스타일을 하나씩 들고 있게 된다.
     */
    markProps,
    /**
     * 하이라이트는 **파생값이다.** 지역 상태로 따로 들고 있으면 소유자의 `focusSegmentId`와
     * 두 개의 진실이 되고, 끄는 타이밍을 양쪽에서 맞춰야 한다. 위 타이머가 소유자에게
     * 비우라고 알리면 여기도 함께 꺼진다.
     */
    isHighlighted,
  };
}
