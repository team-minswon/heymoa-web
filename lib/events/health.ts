"use client";

import { createContext, useContext } from "react";

/** 이벤트 스트림이 건강한가(PRO-67 I02). provider(`components/events/user-event-provider`)가 채운다. */
export const EventStreamHealthContext = createContext(false);

/** `ready` 를 받았고 끊기거나 `degraded` 가 오지 않았다. provider 밖이면 늘 `false` — 원래 간격으로 폴링한다. */
export function useEventStreamHealthy() {
  return useContext(EventStreamHealthContext);
}
