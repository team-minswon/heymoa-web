"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export const LEGAL_FOCUS =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring";

export function LegalToc({
  label,
  items,
}: {
  label: string;
  items: readonly { id: string; title: string }[];
}) {
  const [active, setActive] = useState<string | null>(null);

  // 새 탭으로 바로 연 `#section-N` 은 본문이 그려지기 전에 브라우저가 도착점을 찾아 맨 위에 머물러, 그려진 뒤 한 번 맞춥니다.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  useEffect(() => {
    // IntersectionObserver 는 빠르게 건너뛸 때 지나친 조를 놓쳐, 스크롤마다 위치를 잽니다.
    const LINE = 120;
    const update = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current: string | null = null;
      for (const { id } of items) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= LINE) current = id;
      }
      setActive(atBottom ? (items.at(-1)?.id ?? current) : current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [items]);

  return (
    <nav aria-label={label}>
      <ol className="m-0 flex list-none flex-col border-l border-border p-0">
        {items.map(({ id, title }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={active === id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l py-1.5 pr-2 pl-3.5 text-[13.5px] leading-[1.5] transition-colors",
                active === id
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:border-[var(--el-hairline-strong)] hover:text-foreground",
                LEGAL_FOCUS
              )}
            >
              {title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
