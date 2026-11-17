"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { track } from "@/lib/analytics/track";
import { helpLocation, trackHelp } from "@/lib/help/analytics";

let lastPath: string | null = null;

function entryOf(previous: string | null) {
  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (previous === null && nav?.type === "back_forward") return "back" as const;
  if (new URLSearchParams(window.location.search).has("q")) return "search" as const;
  const isHub = (path: string) => helpLocation(path).level === "hub";
  if (previous !== null) return isHub(previous) ? ("hub" as const) : ("internal" as const);
  try {
    const ref = new URL(document.referrer);
    if (ref.origin === window.location.origin)
      return isHub(ref.pathname) ? ("hub" as const) : ("internal" as const);
  } catch {
  }
  return "external" as const;
}

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
