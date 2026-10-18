import { useSyncExternalStore } from "react";

import { helpGroups } from "@/app/(static)/help/_content/groups";
import type { HelpAxis } from "@/app/(static)/help/_content/types";

/** 주소에서 이 페이지가 속한 축. 허브와 알 수 없는 주소는 기능별이다. */
export function axisOfPath(pathname: string): HelpAxis {
  const slug = pathname.split("/")[2];
  return helpGroups.find((group) => group.slug === slug)?.axis ?? "feature";
}

/**
 * 상단 탭이 고른 축. 상단바(`<main>` 밖)와 사이드바(`<main>` 안)가 서로 다른 트리라 모듈 값으로 나눈다.
 * 고른 값은 고를 때의 주소에만 유효하다 — 다른 페이지로 가면 그 페이지가 속한 축이 기본이다.
 */
let pick: { path: string; axis: HelpAxis } | null = null;
const listeners = new Set<() => void>();

export function pickHelpAxis(path: string, axis: HelpAxis) {
  pick = { path, axis };
  listeners.forEach((fn) => fn());
}

export function useHelpAxis(pathname: string): HelpAxis {
  const picked = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => pick,
    () => null
  );
  return picked?.path === pathname ? picked.axis : axisOfPath(pathname);
}
