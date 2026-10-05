import { BrowserWindow, ipcMain, screen, type Tray } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  MEETING_CHANNELS,
  popoverBounds,
  type MeetingPopoverView,
} from "./meeting-timeline";

export function createMeetingPopover(
  tray: Tray,
  read: () => MeetingPopoverView,
  action: (value: "stop" | "show-current") => void
) {
  let popup: BrowserWindow | null = null;
  let disposed = false;
  let ready = false;
  let visibleRequested = false;
  const file = path.join(__dirname, "meeting.html");
  const url = pathToFileURL(file).href;
  function authorized(event: Electron.IpcMainInvokeEvent) {
    if (
      !popup ||
      popup.isDestroyed() ||
      event.sender !== popup.webContents ||
      event.senderFrame !== popup.webContents.mainFrame ||
      event.senderFrame?.url !== url
    )
      throw new Error("UNTRUSTED_MEETING_REQUEST");
  }
  ipcMain.handle(MEETING_CHANNELS.read, (event, payload: unknown) => {
    authorized(event);
    if (payload !== undefined) throw new Error("INVALID_MEETING_REQUEST");
    return read();
  });
  ipcMain.handle(MEETING_CHANNELS.action, (event, payload: unknown) => {
    authorized(event);
    if (payload === "hide") hide();
    else if (
      payload === "show-current" ||
      (payload === "stop" && read().canStop)
    ) {
      hide();
      action(payload);
    } else throw new Error("INVALID_MEETING_ACTION");
  });
  function position(current: BrowserWindow) {
    const anchor = tray.getBounds();
    const area = screen.getDisplayMatching(anchor).workArea;
    current.setBounds(popoverBounds(anchor, area));
  }
  function show(current: BrowserWindow) {
    if (disposed || !ready || !visibleRequested || current.isDestroyed()) return;
    position(current);
    current.webContents.send(MEETING_CHANNELS.changed, read());
    current.show();
    current.focus();
  }
  function hide() {
    visibleRequested = false;
    if (popup && !popup.isDestroyed()) popup.hide();
  }
  return {
    toggle() {
      if (disposed) return;
      if (popup && !popup.isDestroyed()) {
        visibleRequested = !visibleRequested;
        if (ready) {
          if (visibleRequested) show(popup);
          else hide();
        }
        return;
      }
      ready = false;
      visibleRequested = true;
      const current = new BrowserWindow({
        width: 420,
        height: 580,
        frame: false,
        show: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        backgroundColor: "#ffffff",
        webPreferences: {
          preload: path.join(__dirname, "meeting-preload.js"),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          partition: "heymoa-meeting",
        },
      });
      popup = current;
      const contents = current.webContents;
      contents.session.setPermissionRequestHandler(
        (_wc, _permission, callback) => callback(false)
      );
      contents.session.setPermissionCheckHandler(() => false);
      contents.session.webRequest.onBeforeRequest((details, callback) => {
        // Local display assets only; the popup has no network or service session.
        callback({
          cancel: !details.url.startsWith(
            pathToFileURL(__dirname + path.sep).href
          ),
        });
      });
      contents.setWindowOpenHandler(() => ({ action: "deny" }));
      contents.on("will-navigate", (event) => event.preventDefault());
      contents.on("will-attach-webview", (event) => event.preventDefault());
      current.on("blur", hide);
      current.on("closed", () => {
        if (popup === current) {
          popup = null;
          ready = false;
          visibleRequested = false;
        }
      });
      contents.on("render-process-gone", () => {
        current.destroy();
      });
      void current
        .loadFile(file)
        .then(() => {
          if (popup !== current || current.isDestroyed()) return;
          ready = true;
          show(current);
        })
        .catch(() => {
          if (!current.isDestroyed()) current.destroy();
        });
    },
    refresh() {
      if (ready && popup && !popup.isDestroyed())
        popup.webContents.send(MEETING_CHANNELS.changed, read());
    },
    hide,
    dispose() {
      if (disposed) return;
      disposed = true;
      ipcMain.removeHandler(MEETING_CHANNELS.read);
      ipcMain.removeHandler(MEETING_CHANNELS.action);
      if (popup && !popup.isDestroyed()) popup.destroy();
      popup = null;
    },
  };
}
