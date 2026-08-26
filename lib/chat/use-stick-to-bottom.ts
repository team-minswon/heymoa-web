"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 바닥에서 이만큼 안쪽이면 "바닥에 있다"로 본다. 스크롤 위치는 소수점으로 떨어지고
 * 스트리밍 중에는 높이가 계속 바뀌므로 정확히 0을 기다리면 영영 안 맞는다.
 */
const BOTTOM_THRESHOLD_PX = 48;

/**
 * ★ **떠난 뒤에 다시 붙는 폭. 붙어 있을 때의 폭보다 훨씬 좁다.**
 *
 * 한 값으로 두면 답이 흐르는 동안 **살짝만 올려도 다음 토큰에 도로 감긴다** — 30px 올린
 * 것은 48px 안쪽이라 `sync` 가 「아직 바닥」으로 읽고, 방금 끊은 추적을 스스로 되살린다.
 * 사용자가 보기에는 스크롤이 잠긴 것과 같다.
 *
 * 잘 만든 채팅(ChatGPT · Claude · Slack)이 쓰는 것은 **상태 셋**이다 — 붙어 있다 · 떠나
 * 있다 · 사람이 스스로 돌아왔다. 떠난 뒤에는 **끝까지 내려야** 다시 붙는다.
 */
const REARM_THRESHOLD_PX = 8;

/**
 * 새 내용은 아래로 쌓인다. 유저가 위를 읽고 있을 때 끌어내리지 않도록 **바닥 근처일 때만**
 * 따라간다. 개인 챗봇과 공유 챗봇이 같은 코드를 각자 갖고 있어 하나로 모았다.
 *
 * `atBottom`이 state인 것이 요점이다. 예전에는 ref 하나뿐이라 값이 바뀌어도 화면이 다시
 * 그려지지 않았고, 그래서 "맨 아래로" 버튼을 붙일 수 없었다.
 *
 * **자동 따라가기는 즉시다(부드러운 이동 아님).** 토큰마다 부드럽게 옮기면 애니메이션이
 * 서로를 덮어써서 오히려 끊긴다. 채팅에서 최신 메시지로 튀는 것은 흔한 동작이기도 하다.
 *
 * **한 자리만 예외다 — 보내는 순간(`scrollToSent`).** 방금 보낸 질문이 화면 위로 올라가는
 * 것이 보여야 어디로 갔는지 눈이 따라간다. 그 한 번만 부드럽게 옮긴다.
 *
 * @param tail 내용이 자랐는지 알리는 키. 바뀔 때마다 따라갈지 판단한다.
 */
/**
 * 부드럽게 옮기는 동안은 스크롤 이벤트를 안 읽는 시간. **잰 값이 아니다** — 브라우저의
 * smooth 스크롤 길이는 규격에 없어서 밖에서 알 방법이 없고, 이 값이 정하는 것은
 * 「애니메이션 도중 추적을 껐다고 오해하지 않는 창의 길이」뿐이다.
 */
export const SMOOTH_GUARD_MS = 700;

/** 위로 가려는 키. 손짓과 같은 뜻이라 같은 자리에서 추적을 끊는다. */
const UP_KEYS = new Set(["PageUp", "Home", "ArrowUp"]);

/** 보는 사람이 움직임을 줄여 달라고 했나. jsdom에는 `matchMedia`가 없다. */
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useStickToBottom(tail: string) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  // 스크롤 핸들러가 매번 최신 값을 읽어야 해서 ref도 함께 둔다 — state만으로는
  // 이벤트 리스너가 등록 시점의 값을 붙잡는다.
  const stickRef = useRef(true);
  /** 다음 `tail` 변화 한 번만 부드럽게 옮긴다. */
  const smoothOnceRef = useRef(false);
  /** 이 시각까지는 스크롤 이벤트를 안 읽는다 — 애니메이션 중간 프레임이다. */
  const smoothUntilRef = useRef(0);
  /** 지금 미끄러져 가고 있는 목표. **자라면 다시 겨눈다.** */
  const smoothTargetRef = useRef(0);
  const [atBottom, setAtBottom] = useState(true);

  /**
   * 마지막으로 **눈으로 본** 스크롤 자리. `scroll` 이벤트에서만 적는다 — 우리가 쓴 값이
   * 아니라 브라우저가 확정한 값이라야 「위로 갔나」가 참말이 된다(넘겨 쓴 값은 잘린다).
   * 아직 하나도 못 봤으면 null 이고, 그때는 아무 판정도 안 한다.
   */
  const lastTopRef = useRef<number | null>(null);

  /**
   * ★ **우리가 마지막으로 둔 자리.** `jumpToBottom` 에서만, 옮긴 뒤 **읽어서** 적는다.
   *
   * `ResizeObserver` 가 이것을 본다. `wheel`·터치·키는 `release()` 가 그 자리에서 끊지만
   * **스크롤바 드래그는 그 셋 중 아무것도 안 나고 `scroll` 만 난다.** `scroll` 은 비동기라,
   * 그 사이 답이 자라 `ResizeObserver` 가 먼저 돌면 바닥으로 되돌려 버리고 — 뒤늦게 온
   * `scroll` 은 이미 바닥이라 「올라갔다」를 못 본다. 사용자에게는 스크롤이 잠긴 것과 같다.
   * 실측: 흐르는 중에 24px 올리면 1.2초 뒤 0px 으로 되감기고 「맨 아래로」는 끝내 안 떴다.
   *
   * **이벤트를 기다리지 않는다** — 자리는 이미 옮겨져 있으므로 이벤트 없이도 알 수 있다.
   * 참조 구현(`use-stick-to-bottom`)의 `ignoreScrollToTop` 과 같은 생각이다.
   */
  const anchorRef = useRef<number | null>(null);

  const sync = useCallback((viewport: HTMLDivElement) => {
    // 붙어 있을 때와 떠나 있을 때의 폭이 다르다 (`REARM_THRESHOLD_PX`).
    const limit = stickRef.current ? BOTTOM_THRESHOLD_PX : REARM_THRESHOLD_PX;
    const stuck =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
      limit;
    stickRef.current = stuck;
    setAtBottom(stuck);
  }, []);

  /**
   * 우리가 바닥으로 옮긴다. 방향용 값(`lastTopRef`)은 **안 건드린다** — 그쪽은 브라우저가
   * 확정한 값만 담아야 참말이 된다.
   *
   * 대신 `anchorRef` 에 **옮긴 뒤 다시 읽어서** 적는다. 넘겨 쓴 값은 잘리므로
   * (`scrollHeight` 를 넣어도 실제로는 `scrollHeight - clientHeight` 가 된다), 쓴 값을
   * 그대로 기억하면 자리 비교가 늘 어긋난다.
   */
  const jumpToBottom = useCallback((viewport: HTMLDivElement) => {
    // ★ **바닥값을 직접 쓴다.** `scrollHeight` 를 넣어도 브라우저는 어차피 여기로 자르는데,
    // 그냥 넘겨 쓰면 **jsdom 은 안 자른다** — 검사에서만 자리가 어긋나 「사람이 옮겼다」로
    // 읽힌다. 실제 브라우저와 같은 값을 쓰면 둘이 같은 것을 본다.
    viewport.scrollTop = viewport.scrollHeight - viewport.clientHeight;
    anchorRef.current = viewport.scrollTop;
  }, []);

  /**
   * ★ **내가 둔 자리에서 벗어나 있으면 사람이 옮긴 것이다.**
   *
   * `scroll` 이벤트를 기다리지 않는다 — 스크롤바 드래그는 `scroll` 하나뿐이고 그것이
   * **비동기**라, 기다리면 토큰 이펙트와 `ResizeObserver` 가 먼저 돌아 바닥으로
   * 되돌려 버린다. 그러면 뒤늦게 온 `scroll` 은 이미 바닥이라 「올라갔다」를 못 본다.
   * **자리는 이미 옮겨져 있으므로 이벤트 없이도 알 수 있다.**
   *
   * **둘 다 맞아야 참이다.** 자리가 어긋난 것만으로는 부족하다 — 높이가 **줄면**(고정
   * 자리가 개켜지거나 「생각하는 중」이 사라질 때) 브라우저가 `scrollTop` 을 끌어내리는데,
   * 그때도 자리는 어긋나지만 **바닥에는 그대로 붙어 있다.** 사람이 올린 것이면 바닥과의
   * 거리가 함께 벌어진다.
   *
   * 참조 구현(`use-stick-to-bottom`)의 `ignoreScrollToTop` 과 같은 생각이다.
   */
  const movedByUser = useCallback((viewport: HTMLDivElement) => {
    const ours = anchorRef.current;
    if (ours === null) return false;
    const away = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    return viewport.scrollTop < ours - REARM_THRESHOLD_PX && away > REARM_THRESHOLD_PX;
  }, []);

  /**
   * ★ **손이 닿는 순간 그 자리에서 추적을 끊는다.**
   *
   * `scroll` 은 브라우저가 **비동기로** 보낸다. 답이 흐르는 동안에는 토큰마다 아래
   * 이펙트가 돌아 `scrollTop` 을 바닥으로 되돌리는데, 그 되돌림이 큐에 남아 있던
   * `scroll` 보다 **먼저** 돌아서 핸들러는 늘 「바닥」만 읽는다. 그래서 사용자가 아무리
   * 올려도 다음 토큰에 도로 감긴다 — 스크롤이 잠긴 것처럼 보이는 것이 이것이다.
   *
   * 위치로 추측하지 말고 **입력에서 직접** 끊는다. 이벤트 핸들러는 토큰 이펙트보다
   * 먼저 돌므로 경합 자체가 없어진다.
   *
   * **내려가는 손짓은 안 끊는다** — 바닥으로 돌아오는 길이라 `scroll` 이 알아서 다시 켠다.
   */
  const release = useCallback(() => {
    if (!stickRef.current) return;
    stickRef.current = false;
    smoothOnceRef.current = false;
    // 부드러운 이동 중이었어도 손이 이긴다. 창을 닫아야 뒤따르는 `scroll` 이 읽힌다.
    smoothUntilRef.current = 0;
    setAtBottom(false);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // scroll 이벤트는 버블링하지 않아 React의 onScroll을 부모에 걸 수 없다.
    // **부드럽게 옮기는 동안에는 안 읽는다.** 중간 프레임은 아직 바닥이 아니라서, 읽으면
    // 방금 켠 추적을 스스로 끄고 애니메이션이 끝나기도 전에 따라가기를 잃는다.
    const onScroll = () => {
      const top = viewport.scrollTop;
      /**
       * ★ **올라간 것 자체가 손짓이다.**
       *
       * `wheel`·`touchmove`·키만 보면 **스크롤바 드래그가 통째로 빠진다** — 그 셋 중
       * 아무것도 안 나고 `scroll` 만 난다. 우리가 옮기는 것은 늘 바닥 쪽이라, 앞서 본
       * 자리보다 위로 간 것은 사람이 한 것으로 봐도 된다.
       */
      const previous = lastTopRef.current;
      lastTopRef.current = top;
      if (previous !== null && top < previous - 1) release();
      if (Date.now() < smoothUntilRef.current) return;
      sync(viewport);
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) release();
    };
    let touchStartY = 0;
    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      // 손가락이 아래로 = 내용이 위로 = 옛 대화를 보러 간다.
      if ((event.touches[0]?.clientY ?? 0) > touchStartY) release();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (UP_KEYS.has(event.key)) release();
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    viewport.addEventListener("wheel", onWheel, { passive: true });
    viewport.addEventListener("touchstart", onTouchStart, { passive: true });
    viewport.addEventListener("touchmove", onTouchMove, { passive: true });
    viewport.addEventListener("keydown", onKeyDown);
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("keydown", onKeyDown);
    };
  }, [release, sync]);

  /**
   * ★ **높이가 변한 것을 직접 본다.**
   *
   * `tail` 만 보면 **React 가 다시 그릴 때에만** 따라갈지 판단한다. 그런데 높이는 그것
   * 말고도 자란다 — 접이식이 열리는 220ms 동안, 마크다운 표·코드 블록이 다시 흐를 때,
   * 폰트가 늦게 올 때, 「생각하는 중」이 서고 사라질 때. 그 순간들에는 `tail` 이 안
   * 바뀌므로 바닥에 붙어 있어도 안 따라갔다.
   *
   * 업계 구현(`use-stick-to-bottom`)이 `ResizeObserver` 를 쓰는 이유가 이것이다 —
   * **무엇이 바뀌었는지 몰라도 「높이가 변했다」만 보면 된다.**
   *
   * 뷰포트와 그 안의 내용을 **둘 다** 본다. 뷰포트는 컴포저가 자라거나 접힐 때 바뀌고,
   * 내용은 답이 자랄 때 바뀐다. 스크롤 자리를 쓰는 것은 어느 요소의 크기도 안 바꾸므로
   * 되먹임이 없다.
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    // jsdom 에는 `ResizeObserver` 가 없다 — `personal-chat` 이 같은 자리에서 같이 판다.
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const follow = () => {
      const current = viewportRef.current;
      if (!current || !stickRef.current) return;
      // 미끄러지는 중이면 그쪽이 목표를 들고 있다. 여기서 또 옮기면 둘이 다툰다.
      if (Date.now() < smoothUntilRef.current) return;
      if (movedByUser(current)) {
        release();
        return;
      }
      jumpToBottom(current);
    };
    const observer = new ResizeObserver(follow);
    observer.observe(viewport);
    const content = viewport.firstElementChild;
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [jumpToBottom, movedByUser, release]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    /**
     * ★ **토큰마다 도는 이 자리에도 같은 판정이 필요하다.**
     *
     * `ResizeObserver` 만 막아 두면 여기가 그대로 되돌린다 — 오히려 이쪽이 더 자주 돈다.
     * 실측으로 그 절반만 고치고 「고쳤다」고 할 뻔했다.
     */
    if (stickRef.current && movedByUser(viewport)) release();
    if (!stickRef.current) {
      // 따라가지 않을 때도 상태는 갱신한다. 내용이 자라면 바닥에서 더 멀어지므로
      // 버튼이 떠 있어야 한다.
      smoothOnceRef.current = false;
      sync(viewport);
      return;
    }

    /**
     * ★ **셋이 같은 스크롤을 다툰다** — 보내는 순간의 부드러운 이동, 답이 자라며 도는
     * 자동 따라가기, 그리고 사용자의 손. 순서는 이렇게 정한다.
     *
     * 1. 사용자가 위를 읽고 있으면(`stickRef`가 거짓) **아무도 안 옮긴다** (위 갈래)
     * 2. 보내는 순간의 이동이 **그 700ms 동안 이긴다** — 자동 따라가기는 건너뛴다
     * 3. 그 뒤로는 자동 따라가기
     *
     * 2가 아무것도 안 잃는 것은 질문 아래 자리(`pinSlackPx`) 덕분이다. 답이 자라는 만큼
     * 그 자리가 줄어 `scrollHeight`가 그대로라, 그 사이 따라갈 것이 없다.
     */
    // jsdom에는 `Element.scrollTo`가 없다 — `ResizeObserver`와 같은 자리다.
    if (
      smoothOnceRef.current &&
      typeof viewport.scrollTo === "function" &&
      !prefersReducedMotion()
    ) {
      smoothOnceRef.current = false;
      smoothUntilRef.current = Date.now() + SMOOTH_GUARD_MS;
      smoothTargetRef.current = viewport.scrollHeight;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      /**
       * ★ **창이 닫히면 위치로 추측하지 않고, 켜져 있으면 그냥 마무리한다.**
       *
       * 예전에는 여기서 `sync()`로 다시 읽었다. 사용자가 애니메이션 도중 스크롤을
       * 가로챘을 수 있다는 이유였는데(브라우저는 사용자 입력에 smooth 이동을 멈춘다),
       * **그 추측이 틀리는 자리가 있다.** 700ms 는 잰 값이 아니라 밖에서 알 수 없는
       * 값이고, 스레드가 길어질수록 이동 거리가 커져 **그때까지 도착 못 한다.**
       * 그러면 「아직 바닥이 아니다 = 사용자가 가로챘다」로 읽고 추적을 끈다 —
       * 남은 답이 화면 밖에서 흐르고, 다음 질문을 보낼 때는 바닥에서 멀어져 있어
       * 이동 거리가 또 커진다. 「첫 채팅은 스르륵, 다음부터는 확」이 이것이다.
       *
       * 가로챘는지는 **추측할 필요가 없다.** 손짓·키는 `release()`가 그 자리에서
       * 동기로 끄고, 그것이 이 타이머보다 먼저 돈다. 그래서 여기 도달했을 때
       * 추적이 아직 켜져 있으면 **아무도 안 건드린 것**이고, 그때는 가던 자리로
       * 마무리하면 된다.
       */
      window.setTimeout(() => {
        const current = viewportRef.current;
        if (current && stickRef.current) jumpToBottom(current);
      }, SMOOTH_GUARD_MS);
      return;
    }
    smoothOnceRef.current = false;
    if (Date.now() < smoothUntilRef.current) {
      /**
       * ★ **미끄러지는 동안 바닥이 자라면 다시 겨눈다.**
       *
       * 이 창이 하는 일은 「애니메이션 중간 프레임을 바닥이 아니라고 오해하지 않기」인데,
       * 그렇다고 **목표까지 굳혀 두면** 창이 열린 사이에 자란 만큼이 통째로 남는다 —
       * 컴포저가 접히며 늦게 온 뷰포트 높이, 새로 선 「생각하는 중」, 자리를 넘어선 답이
       * 다 여기 걸린다. 그러면 창이 닫히는 순간 남은 거리를 **한 프레임에 뛴다**(실측
       * 131px). 그 도약이 「보내면 끼벅한다」의 정체다.
       *
       * 자랐을 때만 다시 건다. 매 토큰 다시 걸면 브라우저가 애니메이션을 계속 처음부터
       * 다시 시작해서 오히려 끊긴다.
       */
      if (
        viewport.scrollHeight > smoothTargetRef.current + 1 &&
        typeof viewport.scrollTo === "function" &&
        !prefersReducedMotion()
      ) {
        smoothTargetRef.current = viewport.scrollHeight;
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      }
      return;
    }
    jumpToBottom(viewport);
  }, [jumpToBottom, movedByUser, release, tail, sync]);

  /**
   * ★ **방금 보낸 질문으로 옮긴다. 무조건 돈다.**
   *
   * 「답이 흐르는 동안 따라 내려가기」와 **다른 일이다.** 그쪽은 사용자가 위를 읽고 있으면
   * 안 해야 맞지만, 보내기는 **사용자가 지금 이 순간 한 행동**이라 그 결과를 보여 주는
   * 이동을 「아까 위로 올렸었다」는 이유로 막으면 안 된다 — 오히려 위를 보고 있었다면
   * 더더욱 방금 보낸 자리로 데려가야 한다.
   *
   * 그래서 떠나 있던 추적을 **여기서 다시 켠다.** 안 켜면 질문만 위로 가고 답은 화면
   * 밖에서 흐른다.
   *
   * 예외는 `prefers-reduced-motion` 하나이고, 그것도 **안 옮기는 것이 아니라 애니메이션
   * 없이 즉시** 옮기는 것이다.
   */
  const scrollToSent = useCallback(() => {
    stickRef.current = true;
    setAtBottom(true);
    smoothOnceRef.current = true;
    // ★ **자리에 대한 주장을 버린다.** 안 버리면 `movedByUser` 가 「아까 위로 올라가
    // 있다」를 읽고 방금 켠 추적을 도로 끈다 — 질문만 위로 가고 답은 화면 밖에서 흐른다.
    anchorRef.current = null;
  }, []);

  /**
   * 「맨 아래로」를 눌렀다. **미끄러져 내려간다** — 한 프레임에 뛰면 어디서 어디로
   * 갔는지가 안 보이고, 긴 스레드에서는 화면이 그냥 딴 데로 바뀐 것처럼 읽힌다.
   * 보내는 순간의 이동과 같은 움직임을 쓴다.
   */
  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // **먼저 붙였다고 쳐 둔다.** 사람이 스스로 돌아온 것이라 좁은
    // `REARM_THRESHOLD_PX` 가 아니라 원래 폭으로 재야 한다 — 안 그러면 흐르는 중에
    // 높이가 바뀌어 눌러도 안 붙는 순간이 생긴다.
    stickRef.current = true;
    // 자리에 대한 주장도 버린다 — `scrollToSent` 와 같은 이유다.
    anchorRef.current = null;
    // jsdom 에는 `scrollTo` 가 없고, 움직임을 줄여 달라고 한 사람에게는 안 미끄러진다.
    if (typeof viewport.scrollTo !== "function" || prefersReducedMotion()) {
      jumpToBottom(viewport);
      // 실제로 옮긴 뒤에 상태를 맞춘다 — 먼저 true로 두면 이동이 실패했을 때
      // 버튼만 사라지고 유저는 위에 남는다.
      sync(viewport);
      return;
    }
    smoothUntilRef.current = Date.now() + SMOOTH_GUARD_MS;
    smoothTargetRef.current = viewport.scrollHeight;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    // 미끄러지는 동안 버튼을 미리 감춘다. 중간 프레임은 아직 바닥이 아니라 위치로 재면
    // 애니메이션 내내 버튼이 서 있다가 끝에 툭 사라진다.
    setAtBottom(true);
    // **그래도 위치로 한 번 확인한다.** 미끄러짐이 아무 일도 안 하는 환경이 실제로 있었다
    // (헤드리스). 창이 닫히면 실제 자리를 읽어, 아직 위라면 버튼을 되살린다.
    window.setTimeout(() => {
      const current = viewportRef.current;
      if (current) sync(current);
    }, SMOOTH_GUARD_MS);
  }, [jumpToBottom, sync]);

  return { viewportRef, atBottom, scrollToBottom, scrollToSent };
}
