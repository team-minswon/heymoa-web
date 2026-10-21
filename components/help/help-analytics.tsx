"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { track } from "@/lib/analytics/track";
import { helpLocation, trackHelp } from "@/lib/help/analytics";

/** 앞 화면의 주소. 모듈 값이라 페이지를 옮겨도 이어진다(첫 로드는 null). */
let lastPath: string | null = null;

function entryOf(previous: string | null) {
  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (previous === null && nav?.type === "back_forward") return "back" as const;
  if (new URLSearchParams(window.location.search).has("q")) return "search" as const;
  // 허브는 언어판마다 `/help` · `/en/help` 다
  const isHub = (path: string) => helpLocation(path).level === "hub";
  if (previous !== null) return isHub(previous) ? ("hub" as const) : ("internal" as const);
  try {
    const ref = new URL(document.referrer);
    if (ref.origin === window.location.origin)
      return isHub(ref.pathname) ? ("hub" as const) : ("internal" as const);
  } catch {
    /* 주소를 못 읽으면 바깥에서 온 것으로 본다 */
  }
  return "external" as const;
}

/**
 * 사용 가이드의 열람 · 이동 · 접이식 · 대시보드 이동 이벤트. 화면에는 아무것도 그리지 않는다.
 *
 * - **페이지 열람**은 주소가 바뀔 때 한 번(`lastPath` 와 같으면 다시 안 센다 — StrictMode 재실행 · 같은 페이지 `?q=`/해시 이동 제외).
 * - 나머지 클릭은 문서 한 곳에서 **위임**으로 듣는다: `data-help-nav="<표면>"` 링크(사이드바 · 목차 · 연관 · 이전/다음 · 허브 카드),
 *   `details[data-help-faq]` 의 요약(열릴 때만), 상단바의 `/w/…` 링크(대시보드).
 * 속성은 slug · 순위 · 길이 · 개수뿐이다(`lib/analytics/track.ts`). 수집이 꺼진 환경에서는 `track()` 이 보내지 않는다.
 */
export function HelpAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === lastPath) return;
    const entry = entryOf(lastPath);
    lastPath = pathname;
    const where = helpLocation(pathname);
    track("help_page_viewed", { ...where, entry });
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const here = helpLocation(window.location.pathname);
      const nav = target?.closest<HTMLAnchorElement>("a[data-help-nav]");
      if (nav) {
        const surface = nav.dataset.helpNav as
          | "sidebar"
          | "toc"
          | "related"
          | "prev_next"
          | "hub_card";
        const to =
          surface === "toc"
            ? decodeURIComponent(nav.getAttribute("href")?.slice(1) ?? "")
            : helpLocation(new URL(nav.href, window.location.href).pathname).slug;
        trackHelp("help_nav_clicked", { from_slug: here.slug, to_slug: to, surface });
        return;
      }
      const summary = target?.closest("details[data-help-faq] > summary");
      if (summary) {
        const details = summary.parentElement as HTMLDetailsElement;
        if (!details.open) {
          const all = [
            ...document.querySelectorAll("details[data-help-faq]"),
          ];
          trackHelp("help_faq_opened", { slug: here.slug, index: all.indexOf(details) });
        }
        return;
      }
      const cta = target?.closest<HTMLAnchorElement>("header a[href^='/w/']");
      if (cta) trackHelp("help_cta_clicked", { target: "dashboard", surface: "topbar" });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
