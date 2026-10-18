"use client";

import { usePathname } from "next/navigation";

import { helpGroups } from "@/app/(static)/help/_content/groups";

/**
 * 가이드 이벤트가 싣는 값은 주소에서 뽑은 slug 뿐이다(우리가 정한 값). `/help` → hub, `/help/<그룹>` → 그룹 slug,
 * `/help/<그룹>/<페이지>` → 페이지 slug. 검색어·본문 글은 어떤 이벤트에도 싣지 않는다.
 */
export function helpLocation(pathname: string) {
  const [, , group = "", page = ""] = pathname.split("/");
  const axis =
    helpGroups.find((g) => g.slug === group)?.axis ?? ("feature" as const);
  if (!group) return { slug: "hub", group: "hub", level: "hub", axis: "hub" } as const;
  if (!page) return { slug: group, group, level: "group", axis } as const;
  return { slug: page, group, level: "topic", axis } as const;
}

/** 지금 보는 가이드 페이지의 slug. */
export function useHelpSlug() {
  return helpLocation(usePathname() ?? "").slug;
}
