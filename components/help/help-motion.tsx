"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

import { prefersReducedMotion, scrollToSection } from "@/lib/help/scroll";

/** 등장(`data-reveal`)과 형광펜(`data-key`)은 같은 배선을 쓴다. */
const attrOf = (el: Element) =>
  el.hasAttribute("data-key") ? "data-key" : "data-reveal";

/** 앞 화면의 주소. 모듈 값이라 페이지가 새로 마운트돼도 "다른 가이드 페이지에서 넘어왔다"를 안다(첫 로드는 null). */
let lastPath: string | null = null;

/**
 * 사용 가이드의 모션 배선. 화면에는 아무것도 그리지 않는다. 값은 `app/globals.css` 의 "사용 가이드 모션" 한 곳이다.
 *
 * - **등장(한 번)**: `data-reveal` 요소 중 화면 아래에 있는 것만 숨겼다가(`pending`) 들어오면 보인다(`done`). 이미 보이는 것은
 *   건드리지 않는다. 서버 HTML 은 숨기지 않으므로 JS 가 없어도 본문이 있다.
 * - **페이지 이동**: 다른 가이드 페이지로 넘어온 직후 `[data-help-root] [data-help-main]` 이 짧게 나타난다.
 * - **같은 페이지 앵커**: 가이드 안의 `a[href^="#"]` 를 부드러운 스크롤로 바꾼다(`scrollToSection`).
 */
export function HelpMotion() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const from = lastPath;
    lastPath = pathname;
    if (from === null || from === pathname || prefersReducedMotion()) return;
    const main = document.querySelector<HTMLElement>("[data-help-main]");
    if (!main) return;
    main.setAttribute("data-help-entering", "");
    // 정리 함수로 지우지 않는다 — StrictMode 가 효과를 다시 돌리며 타이머를 끊으면 속성이 남는다.
    window.setTimeout(() => main.removeAttribute("data-help-entering"), 400); // 전환(--help-base 300ms)이 끝난 뒤
  }, [pathname]);

  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined")
      return;
    const pending = [
      ...document.querySelectorAll<HTMLElement>(
        "[data-help-root] [data-reveal]:not([data-reveal='done']), [data-help-root] [data-key]:not([data-key='done'])"
      ),
    ].filter((el) => el.getBoundingClientRect().top >= window.innerHeight);
    if (pending.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute(attrOf(entry.target), "done");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px" }
    );
    for (const el of pending) {
      el.setAttribute(attrOf(el), "pending");
      observer.observe(el);
    }
    return () => observer.disconnect(); // 숨은 요소는 다음 실행이 `pending` 도 다시 잡는다(StrictMode 재실행 포함)
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (
        event.target as Element | null
      )?.closest?.<HTMLAnchorElement>("a[href^='#']");
      if (!link?.closest("[data-help-root]")) return;
      let id = "";
      try {
        id = decodeURIComponent(link.getAttribute("href")!.slice(1));
      } catch {
        return;
      }
      if (!id || !document.getElementById(id)) return;
      event.preventDefault();
      scrollToSection(id);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
