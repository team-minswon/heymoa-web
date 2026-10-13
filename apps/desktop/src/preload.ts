import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopFoundationBridge,
  DesktopAuthBridge,
  DesktopCaptureBridge,
  DesktopCapturePacket,
  DesktopRecordingAction,
  RecordingSummary,
  MeetingTimelineSnapshot,
  ActiveMeeting,
} from "@heymoa/desktop-contracts";
// Sandboxed preload cannot require local modules. Keep runtime imports Electron-only.
if (process.isMainFrame) {
  function userGesture() {
    if (!navigator.userActivation.isActive)
      throw new Error("USER_GESTURE_REQUIRED");
  }
  contextBridge.exposeInMainWorld(
    "heymoaDesktop",
    Object.freeze({
      beginCapture: () => {
        if (!navigator.userActivation.isActive)
          return Promise.reject(new Error("CAPTURE_REQUIRES_USER_GESTURE"));
        return ipcRenderer.invoke("heymoa:capture-begin");
      },
      captureReady: (id: string) =>
        ipcRenderer.invoke("heymoa:capture-ready", id),
      endCapture: (id?: string) => ipcRenderer.invoke("heymoa:capture-end", id),
      subscribeCapture: (listener: (packet: DesktopCapturePacket) => void) => {
        const handler = (
          _event: Electron.IpcRendererEvent,
          packet: DesktopCapturePacket
        ) => {
          try {
            listener(packet);
          } finally {
            if (packet.kind === "pcm")
              ipcRenderer.send("heymoa:capture-ack", {
                id: packet.id,
                sequence: packet.sequence,
              });
          }
        };
        ipcRenderer.on("heymoa:capture-event", handler);
        return () =>
          ipcRenderer.removeListener("heymoa:capture-event", handler);
      },
      getCapabilities: (): ReturnType<
        DesktopFoundationBridge["getCapabilities"]
      > => ipcRenderer.invoke("heymoa:capabilities"),
      beginLogin: () => {
        userGesture();
        return ipcRenderer.invoke("heymoa:auth-login");
      },
      beginConnection: (request: unknown) => {
        userGesture();
        return ipcRenderer.invoke("heymoa:auth-connection", request);
      },
      cancelAuth: () => ipcRenderer.invoke("heymoa:auth-cancel"),
      reportRecording: (summary: RecordingSummary) =>
        ipcRenderer.invoke("heymoa:recording-summary", summary),
      reportMeetingTimeline: (snapshot: MeetingTimelineSnapshot | null) =>
        ipcRenderer.invoke("heymoa:meeting-timeline", snapshot),
      reportActiveMeetings: (meetings: ActiveMeeting[]) =>
        ipcRenderer.invoke("heymoa:active-meetings", meetings),
      subscribeOpenNote: (
        listener: (target: { workspaceId: string; noteId: string }) => void
      ) => {
        const receive = (
          _event: Electron.IpcRendererEvent,
          target: { workspaceId?: unknown; noteId?: unknown }
        ) => {
          if (
            typeof target?.workspaceId === "string" &&
            typeof target?.noteId === "string"
          )
            listener({ workspaceId: target.workspaceId, noteId: target.noteId });
        };
        ipcRenderer.on("heymoa:open-note", receive);
        return () => ipcRenderer.removeListener("heymoa:open-note", receive);
      },
      subscribeRecordingActions: (
        listener: (action: DesktopRecordingAction) => void
      ) => {
        const receive = (
          _event: Electron.IpcRendererEvent,
          action: unknown
        ) => {
          if (action === "show-current" || action === "stop") listener(action);
        };
        ipcRenderer.on("heymoa:recording-action", receive);
        return () =>
          ipcRenderer.removeListener("heymoa:recording-action", receive);
      },
    } satisfies DesktopFoundationBridge &
      DesktopAuthBridge &
      DesktopCaptureBridge)
  );
}
