import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopPreferencesAction,
  DesktopPreferencesView,
} from "./desktop-preferences";
if (process.isMainFrame)
  contextBridge.exposeInMainWorld(
    "heymoaPreferences",
    Object.freeze({
      action: (
        value: "read" | DesktopPreferencesAction
      ): Promise<DesktopPreferencesView> =>
        ipcRenderer.invoke("heymoa:preferences-action", value),
      subscribe: (listener: (view: DesktopPreferencesView) => void) => {
        const receive = (
          _event: Electron.IpcRendererEvent,
          view: DesktopPreferencesView
        ) => listener(view);
        ipcRenderer.on("heymoa:preferences-state", receive);
        return () =>
          ipcRenderer.removeListener("heymoa:preferences-state", receive);
      },
    })
  );
