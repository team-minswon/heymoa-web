"use client";

import type { ComponentProps } from "react";

import { track, type AnalyticsEvent } from "@/lib/analytics/track";

/**
 * 누르면 이벤트를 남기는 `<a>`. 정적 페이지(Server Component)에서 바깥으로 나가는 링크 —
 * 설치 파일처럼 페이지뷰로는 안 잡히는 클릭 — 만 이걸 쓴다. 안쪽 이동은 페이지뷰로 충분하다.
 */
export function TrackedLink({
  event,
  onClick,
  ...props
}: ComponentProps<"a"> & { event: AnalyticsEvent }) {
  return (
    <a
      {...props}
      onClick={(clickEvent) => {
        track(event);
        onClick?.(clickEvent);
      }}
    />
  );
}
