import { contextBridge, ipcRenderer } from "electron";
import type { MeetingPopoverView } from "./meeting-timeline";

// Sandboxed local preload: no generic IPC, file, URL, capture, auth or shell API.
if (process.isMainFrame)
  contextBridge.exposeInMainWorld(
    "heymoaMeeting",
    Object.freeze({
      read: (): Promise<MeetingPopoverView> =>
        ipcRenderer.invoke("heymoa:meeting-read"),
      action: (action: "stop" | "show-current" | "hide") =>
        ipcRenderer.invoke("heymoa:meeting-action", action),
      subscribe: (listener: (view: MeetingPopoverView) => void) => {
        const receive = (
          _event: Electron.IpcRendererEvent,
          view: MeetingPopoverView
        ) => listener(view);
        ipcRenderer.on("heymoa:meeting-changed", receive);
        return () =>
          ipcRenderer.removeListener("heymoa:meeting-changed", receive);
      },
    })
  );
