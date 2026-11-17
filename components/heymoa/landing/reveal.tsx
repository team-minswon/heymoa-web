"use client";

import { useCallback } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function Reveal({
  children,
  ...rest
}: ComponentPropsWithoutRef<"div"> & { children: ReactNode }) {
  const attach = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      el.getBoundingClientRect().top < window.innerHeight
    ) {
      // **앞선 부착이 감춰 뒀으면 걷어낸다.** 그냥 반환하면 안 된다 — react는 ref를 붙였다
      // 떼고 다시 붙이는데(19의 정리 함수), `/#features`처럼 해시로 들어오면 그 사이에
      // 브라우저가 앵커로 점프한다. 첫 부착은 「화면 밖」이라 `data-reveal`을 달고 관찰자를
      // 걸고, 재부착은 「이미 보임」이라 여기로 온다. 관찰자는 정리 단계에서 이미 끊겼으므로,
      // 표시를 안 걷으면 그 카드는 영영 `opacity: 0`이다.
      delete el.dataset.reveal;
      return;
    }

    el.dataset.reveal = "";
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        el.dataset.shown = "";
        io.disconnect();
      },
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
