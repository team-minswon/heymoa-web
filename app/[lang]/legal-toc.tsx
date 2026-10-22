"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export const LEGAL_FOCUS =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * 약관·처리방침 목차. 읽는 중인 조를 왼쪽 선과 진한 글자로 짚는다(Stripe·Linear 정책 페이지와 같은 방식).
 * 머리가 화면 위 1/3 선을 넘은 조 가운데 마지막 것이 「읽는 중」이다. 페이지 끝에 닿으면 마지막 조를 짚는다
 * — 짧은 끝 조들은 위 1/3 선까지 올라오지 못한다.
 */
export function LegalToc({
  label,
  items,
}: {
  label: string;
  items: readonly { id: string; title: string }[];
}) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    // 관찰자(IntersectionObserver)는 빠르게 건너뛸 때 지나친 조를 놓쳐 낡은 조에 머물렀다 — 스크롤마다 위치를 잰다.
    // 조 열두 개의 위치를 재는 정도라 프레임 묶음(rAF) 없이 바로 잰다.
    const update = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current: string | null = null;
      for (const { id } of items) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= window.innerHeight / 3) current = id;
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
