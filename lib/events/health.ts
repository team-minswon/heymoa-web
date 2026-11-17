"use client";

import { createContext, useContext } from "react";

export const EventStreamHealthContext = createContext(false);

export function useEventStreamHealthy() {
  return useContext(EventStreamHealthContext);
}
