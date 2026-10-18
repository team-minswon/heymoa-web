import type { ReactNode } from "react";

/**
 * 단계 목록 — 따라 하는 글은 한 단계에 한 동작만 적는다. 번호는 굵은 원으로 보여 훑어 읽기 쉽게 한다(서버 렌더, 스크립트 없음).
 * 단계 글은 JSON-LD `HowTo` 와 검색 색인이 같은 글을 쓴다(`children` 의 글자만 뽑는다).
 */
export function HelpSteps({ children }: { children: readonly ReactNode[] }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {children.map((step, index) => (
        <li
          key={index}
          data-reveal=""
          className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3"
        >
          <span
            aria-hidden
            className="mt-0.5 grid size-7 place-items-center rounded-full bg-[var(--tv-brand-deep)] text-[13px] font-extrabold text-white"
          >
            {index + 1}
          </span>
          <span className="break-keep">{step}</span>
        </li>
      ))}
    </ol>
  );
}
