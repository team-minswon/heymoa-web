"use client";

import type { ComponentProps } from "react";

import { track, type AnalyticsEvent } from "@/lib/analytics/track";

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
