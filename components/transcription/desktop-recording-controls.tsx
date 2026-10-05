"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  DesktopBridge,
  RecordingSummary,
} from "@heymoa/desktop-contracts";
import { useRecording } from "./recording-provider";
import { DesktopMeetingTimeline } from "./desktop-meeting-timeline";

/** Native receives only recording metadata; navigation and session ownership stay in the web. */
export function DesktopRecordingControls() {
  const router = useRouter();
  const {
    phase,
    session,
    activeNoteId,
    activeWorkspaceId,
    buffer,
    microphone,
    systemAudio,
    stop,
  } = useRecording();
  const pendingMs = buffer?.pendingMs ?? 0;
  const startedAt = session?.startedAt ? Date.parse(session.startedAt) : null;
  const bridge =
    typeof window === "undefined"
      ? undefined
      : (window as unknown as { heymoaDesktop?: DesktopBridge }).heymoaDesktop;

  useEffect(() => {
    if (!bridge?.reportRecording) return;
    const summary: RecordingSummary = {
      phase,
      startedAt:
        startedAt !== null && Number.isFinite(startedAt) ? startedAt : null,
      pendingMs,
      microphone: phase === "idle" ? null : microphone,
      systemAudio: systemAudio ?? null,
    };
    void bridge.reportRecording(summary).catch(() => {
      // Main keeps its previous unsafe/unknown state when reporting fails.
      console.warn("Desktop recording status could not be reported");
    });
  }, [bridge, phase, startedAt, pendingMs, microphone, systemAudio]);

  useEffect(() => {
    if (!bridge?.subscribeRecordingActions) return;
    return bridge.subscribeRecordingActions((action) => {
      if (action === "stop" && phase === "recording") void stop();
      else if (action === "show-current" && activeWorkspaceId && activeNoteId)
        router.push(
          `/w/${encodeURIComponent(activeWorkspaceId)}/notes/${encodeURIComponent(activeNoteId)}?view=full&tab=transcript`
        );
    });
  }, [bridge, activeWorkspaceId, activeNoteId, phase, router, stop]);
  return <DesktopMeetingTimeline />;
}
