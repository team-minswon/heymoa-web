"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { HelpCluster, HelpGroup } from "@/app/(static)/help/_content/types";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import { useHelpAxis } from "@/components/help/help-axis";
import { cn } from "@/lib/utils";

type SidebarTopic = { slug: string; group: string; title: string };

const ITEM =
  "flex min-h-8 items-center rounded-[8px] px-3 py-1 text-[14px] leading-[1.45] break-keep help-fade";

/**
 * 왼쪽 주제 목록. 상단 탭이 고른 축의 모든 그룹을 **항상 펼친** 평평한 목록으로 낸다(접힘 없음). 상단바 아래 전체 높이로
 * 붙고 자체로 스크롤한다. 현재 페이지는 연한 회색 배경 + 글자색(`aria-current="page"`), hover 는 한 단계 더 옅은 회색이다.
 * **선택해도 굵기·크기를 바꾸지 않는다** — 굵기가 달라지면 글자 폭이 달라져 줄바꿈과 목록 높이가 출렁인다(실측: 항목 높이 32↔49).
 * 레이아웃에 서서 페이지를 옮겨도 다시 그려지지 않으므로 스크롤 위치가 유지되고, 현재 항목이 안 보일 때만 맞춘다.
 */
export function HelpSidebar({
  groups,
  clusters,
  topics,
}: {
  groups: readonly HelpGroup[];
  clusters: readonly HelpCluster[];
  topics: readonly SidebarTopic[];
}) {
  const pathname = usePathname();
  const axis = useHelpAxis(pathname);
  const box = useRef<HTMLDivElement>(null);
  // 기능별은 그룹 제목(그룹 소개로 가는 링크) 아래 그 그룹의 페이지, 상황별은 묶음 제목(표시용) 아래 레시피. 둘 다 같은 모양이다.
  const sections =
    axis === "feature"
      ? groups
          .filter((group) => group.axis === "feature")
          .map((group) => ({
            key: group.slug,
            title: group.title,
            href: `/help/${group.slug}`,
            topics: topics.filter((topic) => topic.group === group.slug),
          }))
      : clusters.map((cluster) => ({
          key: cluster.title,
          title: cluster.title,
          href: null,
          topics: cluster.pages.flatMap((slug) =>
            topics.filter((topic) => topic.slug === slug)
          ),
        }));
  // 누른 즉시 활성 표시를 옮긴다(낙관적). 라우트 전환이 끝나 주소가 바뀌면 그 값이 이어받고, 오래 안 바뀌면(실패) 되돌린다.
  const [pending, setPending] = useState<string | null>(null);
  const current = pending ?? pathname;

  useEffect(() => {
    setPending(null); // eslint-disable-line react-hooks/set-state-in-effect -- 주소가 바뀌면 낙관적 표시를 거둔다
  }, [pathname]);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setPending(null), 4000);
    return () => window.clearTimeout(timer);
  }, [pending]);
  const onPick = (path: string) => (event: React.MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setPending(path);
  };

  useLayoutEffect(() => {
    const el = box.current;
    const current = el?.querySelector<HTMLElement>("[aria-current='page']");
    if (!el || !current) return;
    const top = current.offsetTop;
    const bottom = top + current.offsetHeight;
    if (top < el.scrollTop + 48 || bottom > el.scrollTop + el.clientHeight - 48)
      el.scrollTop = top - el.clientHeight / 3;
  }, [current, axis]);

  return (
    <div
      ref={box}
      className="sticky top-[var(--help-top)] hidden h-[calc(100dvh-var(--help-top))] w-[264px] shrink-0 self-start overflow-y-auto border-r border-[var(--tv-rule)] bg-white lg:block"
    >
      <nav aria-label="사용 가이드 주제" className="flex flex-col gap-5 px-3 py-5">
        {sections.map((section) => (
          <div key={section.key}>
            <p className="m-0 mb-1">
              {section.href ? (
                <Link
                  href={section.href}
                  aria-current={current === section.href ? "page" : undefined}
                  onClick={onPick(section.href)}
                  className={cn(
                    ITEM,
                    "font-extrabold text-[var(--tv-ink)] hover:bg-[var(--tv-lav-soft)]",
                    FOCUS,
                    current === section.href && "bg-[var(--tv-lav)]"
                  )}
                >
                  {section.title}
                </Link>
              ) : (
                <span
                  className={cn(
                    ITEM,
                    "min-h-8 font-extrabold text-[var(--tv-ink)]"
                  )}
                >
                  {section.title}
                </span>
              )}
            </p>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {section.topics.map((topic) => {
                const path = `/help/${topic.group}/${topic.slug}`;
                const on = current === path;
                return (
                  <li key={topic.slug}>
                    <Link
                      href={path}
                      aria-current={on ? "page" : undefined}
                      onClick={onPick(path)}
                      className={cn(
                        ITEM,
                        FOCUS,
                        on
                          ? "bg-[var(--tv-lav)] text-[var(--tv-ink)]"
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
        ))}
      </nav>
    </div>
  );
}
