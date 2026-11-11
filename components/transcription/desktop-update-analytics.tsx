"use client";

import { useEffect, useRef } from "react";
import type { DesktopUpdateState } from "@heymoa/desktop-contracts";
import { desktopUpdateBridge } from "@/lib/desktop/updates";
import { track } from "@/lib/analytics/track";

/** Observe outside settings so automatic downloads remain visible after the dialog closes. */
export function DesktopUpdateAnalytics() {
  const previous = useRef<DesktopUpdateState | null>(null);
  useEffect(() => {
    const bridge = desktopUpdateBridge();
    if (!bridge) return;
    let live = true;
    let received = false;
    const observe = (state: DesktopUpdateState) => {
      if (!live) return;
      const old = previous.current;
      previous.current = { ...state };
      if (old?.status !== state.status || old?.version !== state.version) {
        track(
          "desktop_update_status_changed",
          {
            current_version: state.currentVersion,
            target_version: state.version,
            status: state.status,
            automatic: state.automatic,
            initial: old === null,
          },
          state.status === "installing"
            ? { send_instantly: true, transport: "sendBeacon" }
            : undefined
        );
      }
      if (
        state.status === "ready" &&
        !state.canRestart &&
        (old?.status !== "ready" ||
          old.canRestart ||
          old.version !== state.version)
      ) {
        track("desktop_update_restart_blocked", {
          current_version: state.currentVersion,
          target_version: state.version,
        });
      }
    };
    const unsubscribe = bridge.subscribeUpdates((state) => {
      received = true;
      observe(state);
    });
    void bridge
      .getUpdateState()
      .then((state) => {
        if (!received) observe(state);
      })
      .catch(() => {
        if (live) track("desktop_update_request_failed", { action: "state" });
      });
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  return null;
}
