"use client";

import { cloneElement, useCallback } from "react";
import type { ReactElement, Ref } from "react";

/**
 * 스크롤에 맞춰 한 번 올라온다.
 *
 * **JS가 없으면 아무것도 감추지 않는다.** 숨김 상태를 서버 HTML에 넣지 않고 붙은 뒤에
 * `data-reveal`을 단다 — `PageTransition`이 `opacity:0`인 HTML을 내보내는 바람에 JS를 끄면
 * 화면이 통째로 비어 있던 적이 있다. 같은 함정을 두 번 밟지 않는다.
 *
 * **이미 보이는 것은 건드리지 않는다.** 붙는 시점에 뷰포트 안이면 그대로 둔다 — 안 그러면
 * 보이던 것이 하이드레이션 순간 사라졌다 다시 떠서 깜빡인다.
 *
 * **축소 모션이면 통째로 건너뛴다.** 아래로 미는 연출은 전정 자극이 되는 종류라
 * `prefers-reduced-motion`을 존중해야 한다.
 *
 * 한 번 뜨면 관찰을 끊는다 — 스크롤을 되돌릴 때마다 다시 튀면 읽는 흐름이 끊긴다.
 *
 * 콜백 ref로 다는 이유는 자식이 서버에서 그려진 엘리먼트라서다. `cloneElement`로 ref만
 * 얹으면 그 아래 트리는 서버 컴포넌트로 남는다.
 */
export function Reveal({ children }: { children: ReactElement<{ ref?: Ref<HTMLElement> }> }) {
  const attach = useCallback((el: HTMLElement | null) => {
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

  return cloneElement(children, { ref: attach });
}
