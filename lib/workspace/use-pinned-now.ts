"use client";

import { useSyncExternalStore } from "react";

/**
 * 기한 판정에 쓸 「지금」. 렌더 중에 `Date.now()`를 부르면 서버와 클라이언트가 갈려
 * hydration이 어긋나므로 **서버 스냅샷은 null**이다 — 그동안 호출부는 스켈레톤을 그린다.
 *
 * 클라이언트 값은 한 번 읽고 고정한다. 매번 새로 읽으면 `useSyncExternalStore`가 스냅샷이
 * 계속 바뀐다고 보고 무한 렌더에 빠지고, 그게 아니라도 사용자가 보고 있는 동안 행이 묶음
 * 사이를 넘나들어 방금 읽은 자리를 잃는다.
 */
let pinnedNow: number | null = null;
const NEVER_CHANGES = () => () => {};
const getClientNow = () => (pinnedNow ??= Date.now());
const getServerNow = () => null;

export function usePinnedNow(): number | null {
  return useSyncExternalStore(NEVER_CHANGES, getClientNow, getServerNow);
}
