"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { FOCUS } from "@/components/heymoa/landing/tokens";
import { cn } from "@/lib/utils";

const SPY_OFFSET = 120;

export function HelpPageToc({
  sections,
  label,
  hideLabel = false,
  className,
}: {
  sections: readonly { id: string; title: string }[];
  label?: string;
  hideLabel?: boolean;
  className?: string;
}) {
  const t = useTranslations("help.page");
  const [active, setActive] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const bar = barRef.current;
    if (!list || !bar) return;
    const place = () => {
      const index = sections.findIndex((section) => section.id === active);
      const link = list.querySelectorAll("li")[index]?.firstElementChild as
        | HTMLElement
        | undefined;
      if (!link || !link.offsetHeight) {
        bar.style.opacity = "0";
        return;
      }
      const hidden = bar.style.opacity !== "1";
      if (hidden) bar.style.transition = "none";
      bar.style.transform = `translateY(${link.offsetTop + (link.offsetHeight - 16) / 2}px)`;
      bar.style.opacity = "1";
      if (hidden) {
        void bar.offsetWidth;
        bar.style.transition = "";
      }
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active, sections]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      let found: string | null = null;
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top <= SPY_OFFSET)
          found = section.id;
      }
      setActive(atBottom ? sections[sections.length - 1].id : found);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sections]);

  return (
    <nav aria-label={t("toc")} className={className}>
      {hideLabel ? null : (
        <p className="m-0 mb-2 px-3 text-[13px] font-extrabold tracking-[0.02em] text-[var(--tv-muted)]">
          {label ?? t("onThisPage")}
        </p>
      )}
      <ol
        ref={listRef}
        className="relative m-0 flex list-none flex-col gap-0.5 border-l border-[var(--tv-rule-strong)] p-0"
      >
        <span
          ref={barRef}
          aria-hidden
          className="help-slide pointer-events-none absolute top-0 -left-px h-4 w-[3px] rounded-full bg-[var(--tv-brand)] opacity-0"
        />
        {sections.map((section) => {
          const on = active === section.id;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                data-toc-link=""
                data-help-nav="toc"
                aria-current={on ? "location" : undefined}
                className={cn(
                  "relative -ml-px flex min-h-8 items-center rounded-r-[8px] py-1 pr-3 pl-3.5 text-[13px] leading-[1.45] help-fade",
                  FOCUS,
                  on
                    ? "bg-[var(--tv-lav-soft)] text-[var(--tv-ink)]"
                    : "text-[var(--tv-body)] hover:bg-[var(--tv-lav-soft)] hover:text-[var(--tv-ink)]"
                )}
              >
                {section.title}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
