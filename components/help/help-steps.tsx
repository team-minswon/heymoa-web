import type { ReactNode } from "react";

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
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
