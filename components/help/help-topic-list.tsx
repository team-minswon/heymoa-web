import Link from "next/link";
import { ChevronDown } from "lucide-react";

import type {
  HelpAxis,
  HelpGroup,
  HelpTopic,
} from "@/app/(static)/help/_content/types";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import { cn } from "@/lib/utils";

const AXES: { axis: HelpAxis; label: string }[] = [
  { axis: "feature", label: "기능별" },
  { axis: "situation", label: "상황별" },
];

const ITEM =
  "relative flex min-h-9 items-center rounded-[8px] px-3 py-1.5 text-[14px] leading-[1.45] break-keep help-fade before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-[var(--tv-brand)] before:opacity-0 before:transition-opacity before:duration-(--help-fast) before:ease-(--help-ease) motion-reduce:before:transition-none";

/**
 * 「가이드 전체」 — 왼쪽 기둥의 두 축 목록. **기능별**(그룹 제목 아래 페이지)과 **상황별**(「이럴 때」 레시피)을 갈라 둔다.
 * 지금 보는 쪽 축은 펼쳐 두고 다른 축은 접어 둔다(`<details>`, 서버가 그린 대로 — 스크립트 없음). 그룹 제목은 작고 굵은 글씨,
 * 현재 페이지는 `aria-current="page"` 로 진하게 + 왼쪽 막대로 표시한다.
 */
export function HelpTopicList({
  groups,
  topics,
  current,
  axis: currentAxis,
}: {
  groups: readonly HelpGroup[];
  topics: readonly HelpTopic[];
  current?: string;
  axis: HelpAxis;
}) {
  return (
    <nav aria-label="사용 가이드 주제" className="flex flex-col gap-2">
      {AXES.map(({ axis, label }) => (
        <details
          key={axis}
          open={axis === currentAxis}
          className="details-motion group/axis [&_summary::-webkit-details-marker]:hidden"
        >
          <summary
            className={cn(
              "flex min-h-9 cursor-pointer list-none items-center justify-between rounded-[8px] px-3 text-[13px] font-extrabold tracking-[0.02em] text-[var(--tv-ink)] help-fade hover:bg-white",
              FOCUS
            )}
          >
            {label}
            <ChevronDown
              aria-hidden
              className="size-4 text-[var(--tv-muted)] transition-transform duration-(--help-base) ease-(--help-ease) group-open/axis:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="mt-1 flex flex-col gap-3 pb-2">
            {groups
              .filter((group) => group.axis === axis)
              .map((group) => (
                <div key={group.slug}>
                  {axis === "feature" ? (
                    <p className="m-0 mb-1 px-3 text-[12px] font-extrabold tracking-[0.02em] text-[var(--tv-muted)]">
                      <Link
                        href={`/help/${group.slug}`}
                        className={cn(
                          "rounded-[4px] hover:text-[var(--tv-brand-deep)]",
                          FOCUS
                        )}
                      >
                        {group.title}
                      </Link>
                    </p>
                  ) : null}
                  <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                    {topics
                      .filter((topic) => topic.group === group.slug)
                      .map((topic) => {
                        const on = topic.slug === current;
                        return (
                          <li key={topic.slug}>
                            <Link
                              href={`/help/${topic.group}/${topic.slug}`}
                              aria-current={on ? "page" : undefined}
                              className={cn(
                                ITEM,
                                FOCUS,
                                on
                                  ? "bg-white font-extrabold text-[var(--tv-ink)] before:opacity-100"
                                  : "text-[var(--tv-body)] hover:bg-white hover:text-[var(--tv-brand-deep)]"
                              )}
                            >
                              {topic.title}
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
          </div>
        </details>
      ))}
    </nav>
  );
}
