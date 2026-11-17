"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RecordingSummary } from "@heymoa/desktop-contracts";
import { desktopBridge } from "@/lib/desktop/bridge";
import { useRecording } from "./recording-provider";
import { DesktopActiveMeetings } from "./desktop-active-meetings";
import { DesktopMeetingTimeline } from "./desktop-meeting-timeline";
import { DesktopUpdateAnalytics } from "./desktop-update-analytics";

export function DesktopRecordingControls() {
  const router = useRouter();
  const {
    phase,
    clockOriginMs,
    activeNoteId,
    activeWorkspaceId,
    buffer,
    microphone,
    systemAudio,
    stop,
  } = useRecording();
  const pendingMs = buffer?.pendingMs ?? 0;
  const startedAt = clockOriginMs;
  const bridge = desktopBridge();

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
    const report = () =>
      void bridge.reportRecording(summary).catch(() => {
        console.warn("Desktop recording status could not be reported");
      });
    report();
    if (!bridge.getUpdateState) return;
    const timer = window.setInterval(report, 5_000);
    return () => window.clearInterval(timer);
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
  return (
    <>
      <DesktopUpdateAnalytics />
      <DesktopMeetingTimeline />
      <DesktopActiveMeetings />
    </>
  );
}
