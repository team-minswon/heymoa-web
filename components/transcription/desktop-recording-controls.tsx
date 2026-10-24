"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  DesktopBridge,
  RecordingSummary,
} from "@heymoa/desktop-contracts";
import { useRecording } from "./recording-provider";
import { DesktopActiveMeetings } from "./desktop-active-meetings";
import { DesktopMeetingTimeline } from "./desktop-meeting-timeline";

/** Native receives only recording metadata; navigation and session ownership stay in the web. */
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
  // 트레이 시계는 `지금 − startedAt` 이다. 세션 시작이 아니라 녹음 시계의 원점을 보내야 재개해도 0으로
  // 돌아가지 않고 독 · 스크립트 줄 시각과 같은 수를 센다.
  const startedAt = clockOriginMs;
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
  return (
    <>
      <DesktopMeetingTimeline />
      <DesktopActiveMeetings />
    </>
  );
}
