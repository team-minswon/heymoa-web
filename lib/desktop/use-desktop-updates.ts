"use client";

import { useEffect, useState } from "react";
import type { DesktopUpdateState } from "@heymoa/desktop-contracts";
import { desktopUpdateBridge } from "./updates";

export function useDesktopUpdates() {
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  useEffect(() => {
    const bridge = desktopUpdateBridge();
    if (!bridge) return;
    let live = true,
      received = false;
    const unsubscribe = bridge.subscribeUpdates((next) => {
      received = true;
      if (live) setState(next);
    });
    void bridge
      .getUpdateState()
      .then((next) => {
        if (live && !received) setState(next);
      })
      .catch(() => {});
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  return state;
}
export function hasDesktopUpdate(state: DesktopUpdateState | null) {
  return Boolean(
    state?.version &&
    state.version !== state.currentVersion &&
    ["available", "downloading", "ready"].includes(state.status)
  );
}
