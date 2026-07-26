"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 바닥에서 이만큼 안쪽이면 "바닥에 있다"로 본다. 스크롤 위치는 소수점으로 떨어지고
 * 스트리밍 중에는 높이가 계속 바뀌므로 정확히 0을 기다리면 영영 안 맞는다.
 */
const BOTTOM_THRESHOLD_PX = 48;

/**
 * 새 내용은 아래로 쌓인다. 유저가 위를 읽고 있을 때 끌어내리지 않도록 **바닥 근처일 때만**
 * 따라간다. 개인 챗봇과 공유 챗봇이 같은 코드를 각자 갖고 있어 하나로 모았다.
 *
 * `atBottom`이 state인 것이 요점이다. 예전에는 ref 하나뿐이라 값이 바뀌어도 화면이 다시
 * 그려지지 않았고, 그래서 "맨 아래로" 버튼을 붙일 수 없었다.
 *
 * **이동은 즉시다(부드러운 이동 아님).** smooth로 하면 애니메이션 중간 scroll 이벤트가
 * "아직 바닥이 아니다"로 읽혀 방금 켠 추적을 도로 끈다. 가드를 두는 방법도 있지만,
 * 자동 따라가기가 이미 즉시 이동이라 굳이 두 갈래로 만들 이유가 없다. 채팅에서 최신
 * 메시지로 튀는 것은 흔한 동작이기도 하다.
 *
 * @param tail 내용이 자랐는지 알리는 키. 바뀔 때마다 따라갈지 판단한다.
 */
export function useStickToBottom(tail: string) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  // 스크롤 핸들러가 매번 최신 값을 읽어야 해서 ref도 함께 둔다 — state만으로는
  // 이벤트 리스너가 등록 시점의 값을 붙잡는다.
  const stickRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const sync = useCallback((viewport: HTMLDivElement) => {
    const stuck =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
      BOTTOM_THRESHOLD_PX;
    stickRef.current = stuck;
    setAtBottom(stuck);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // scroll 이벤트는 버블링하지 않아 React의 onScroll을 부모에 걸 수 없다.
    const onScroll = () => sync(viewport);
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [sync]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (!stickRef.current) {
      // 따라가지 않을 때도 상태는 갱신한다. 내용이 자라면 바닥에서 더 멀어지므로
      // 버튼이 떠 있어야 한다.
      sync(viewport);
      return;
    }
    viewport.scrollTop = viewport.scrollHeight;
  }, [tail, sync]);

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
    // 실제로 옮긴 뒤에 상태를 맞춘다 — 먼저 true로 두면 이동이 실패했을 때
    // 버튼만 사라지고 유저는 위에 남는다.
    sync(viewport);
  }, [sync]);

  return { viewportRef, atBottom, scrollToBottom };
}
