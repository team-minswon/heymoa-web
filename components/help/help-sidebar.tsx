"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { HelpGroup } from "@/app/(static)/help/_content/types";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import { useHelpAxis } from "@/components/help/help-axis";
import { cn } from "@/lib/utils";

type SidebarTopic = { slug: string; group: string; title: string };

const ITEM =
  "flex min-h-8 items-center rounded-[8px] px-3 py-1 text-[14px] leading-[1.45] break-keep help-fade";

/**
 * 왼쪽 주제 목록. 상단 탭이 고른 축의 모든 그룹을 **항상 펼친** 평평한 목록으로 낸다(접힘 없음). 상단바 아래 전체 높이로
 * 붙고 자체로 스크롤한다. 현재 페이지는 연한 회색 배경 + 굵게(`aria-current="page"`), hover 는 한 단계 더 옅은 회색이다.
 * 레이아웃에 서서 페이지를 옮겨도 다시 그려지지 않으므로 스크롤 위치가 유지되고, 현재 항목이 안 보일 때만 맞춘다.
 */
export function HelpSidebar({
  groups,
  topics,
}: {
  groups: readonly HelpGroup[];
  topics: readonly SidebarTopic[];
}) {
  const pathname = usePathname();
  const axis = useHelpAxis(pathname);
  const box = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = box.current;
    const current = el?.querySelector<HTMLElement>("[aria-current='page']");
    if (!el || !current) return;
    const top = current.offsetTop;
    const bottom = top + current.offsetHeight;
    if (top < el.scrollTop + 48 || bottom > el.scrollTop + el.clientHeight - 48)
      el.scrollTop = top - el.clientHeight / 3;
  }, [pathname, axis]);

  return (
    <div
      ref={box}
      className="sticky top-[var(--help-top)] hidden h-[calc(100dvh-var(--help-top))] w-[264px] shrink-0 self-start overflow-y-auto border-r border-[var(--tv-rule)] bg-white lg:block"
    >
      <nav aria-label="사용 가이드 주제" className="flex flex-col gap-5 px-3 py-5">
        {groups
          .filter((group) => group.axis === axis)
          .map((group) => {
            const groupPath = `/help/${group.slug}`;
            return (
              <div key={group.slug}>
                <p className="m-0 mb-1">
                  <Link
                    href={groupPath}
                    aria-current={pathname === groupPath ? "page" : undefined}
                    className={cn(
                      ITEM,
                      "font-extrabold text-[var(--tv-ink)] hover:bg-[var(--tv-lav-soft)]",
                      FOCUS,
                      pathname === groupPath && "bg-[var(--tv-lav)]"
                    )}
                  >
                    {group.title}
                  </Link>
                </p>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {topics
                    .filter((topic) => topic.group === group.slug)
                    .map((topic) => {
                      const path = `${groupPath}/${topic.slug}`;
                      const on = pathname === path;
                      return (
                        <li key={topic.slug}>
                          <Link
                            href={path}
                            aria-current={on ? "page" : undefined}
                            className={cn(
                              ITEM,
                              FOCUS,
                              on
                                ? "bg-[var(--tv-lav)] font-extrabold text-[var(--tv-ink)]"
                                : "text-[var(--tv-body)] hover:bg-[var(--tv-lav-soft)] hover:text-[var(--tv-ink)]"
                            )}
                          >
                            {topic.title}
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              </div>
            );
          })}
      </nav>
    </div>
  );
}
