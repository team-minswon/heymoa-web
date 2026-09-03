"use client";

import { useCallback } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * 스크롤에 맞춰 한 번 올라온다. 감쌀 요소를 **직접 그린다**.
 *
 * `cloneElement`로 자식에 ref만 얹는 쪽이 DOM은 깔끔하지만 그렇게 하면 터진다 — 여기 오는
 * 자식은 서버 컴포넌트라 클라이언트에서 복제할 수 있는 엘리먼트가 아니다
 * (`Element type is invalid`). 그래서 `div` 하나를 더 그리고 그것을 관찰한다.
 *
 * `className`과 나머지 속성은 그대로 넘긴다 — 기능 카드처럼 **이 래퍼가 곧 카드**여야
 * 하는 자리가 있어서다(격자 칸이 하나 더 끼면 카드 높이가 안 맞는다).
 *
 * **JS가 없으면 아무것도 감추지 않는다.** 숨김 상태를 서버 HTML에 넣지 않고 붙은 뒤에
 * `data-reveal`을 단다 — `PageTransition`이 `opacity:0`인 HTML을 내보내는 바람에 JS를 끄면
 * 화면이 통째로 비어 있던 적이 있다. 같은 함정을 두 번 밟지 않는다.
 *
 * **이미 보이는 것은 건드리지 않는다.** 붙는 시점에 뷰포트 안이면 그대로 둔다 — 안 그러면
 * 보이던 것이 하이드레이션 순간 사라졌다 다시 떠서 깜빡인다.
 *
 * **축소 모션이면 통째로 건너뛴다.** 아래로 미는 연출은 전정 자극이 되는 종류다.
 *
 * 한 번 뜨면 관찰을 끊는다 — 스크롤을 되돌릴 때마다 다시 튀면 읽는 흐름이 끊긴다.
 */
export function Reveal({
  children,
  ...rest
}: ComponentPropsWithoutRef<"div"> & { children: ReactNode }) {
  const attach = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.dataset.reveal = "";
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        el.dataset.shown = "";
        io.disconnect();
      },
      // 위에서 80px 들어와야 시작한다 — 가장자리에 걸치자마자 켜면 다 보기 전에 끝난다.
      { rootMargin: "-80px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={attach} {...rest}>
      {children}
    </div>
  );
}
