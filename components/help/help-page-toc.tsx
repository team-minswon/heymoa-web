"use client";

import { useEffect, useState } from "react";

import { FOCUS } from "@/components/heymoa/landing/tokens";
import { cn } from "@/lib/utils";

/** 상단 바(64)를 지나 이 높이 위로 올라간 마지막 섹션이 「지금 읽는 곳」이다. */
const SPY_OFFSET = 120;

/**
 * 「이 페이지」 목차. 스크롤하면 지금 읽는 섹션이 진하게 + 왼쪽 막대로 바뀐다(scroll-spy). 서버가 그린 HTML 과 같아야
 * 해서 첫 렌더에는 아무것도 활성이 아니고, 스크롤 위치는 마운트한 뒤에만 읽는다.
 */
export function HelpPageToc({
  sections,
  label = "이 페이지",
  className,
}: {
  sections: readonly { id: string; title: string }[];
  label?: string;
  className?: string;
}) {
  const [active, setActive] = useState<string | null>(null);

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
    <nav aria-label={`${label} 목차`} className={className}>
      <p className="m-0 mb-2 px-3 text-[13px] font-extrabold tracking-[0.02em] text-[var(--tv-muted)]">
        {label}
      </p>
      <ol className="m-0 flex list-none flex-col gap-0.5 border-l border-[var(--tv-rule-strong)] p-0">
        {sections.map((section) => {
          const on = active === section.id;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                data-toc-link=""
                aria-current={on ? "location" : undefined}
                className={cn(
                  "relative -ml-px flex min-h-8 items-center rounded-r-[8px] py-1 pr-3 pl-3.5 text-[13px] leading-[1.45] break-keep transition-colors duration-150 before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-[var(--tv-brand)] before:opacity-0 before:transition-opacity before:duration-150 motion-reduce:transition-none motion-reduce:before:transition-none",
                  FOCUS,
                  on
                    ? "bg-white font-bold text-[var(--tv-ink)] before:opacity-100"
                    : "text-[var(--tv-body)] hover:bg-white hover:text-[var(--tv-brand-deep)]"
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
