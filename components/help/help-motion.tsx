"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

import { prefersReducedMotion, scrollToSection } from "@/lib/help/scroll";

const attrOf = (el: Element) =>
  el.hasAttribute("data-key") ? "data-key" : "data-reveal";

let lastPath: string | null = null;

export function HelpMotion() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const from = lastPath;
    lastPath = pathname;
    if (from === null || from === pathname || prefersReducedMotion()) return;
    const main = document.querySelector<HTMLElement>("[data-help-main]");
    if (!main) return;
    main.setAttribute("data-help-entering", "");
    window.setTimeout(() => main.removeAttribute("data-help-entering"), 550);
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
    return () => observer.disconnect();
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
