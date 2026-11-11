import { BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { DesktopUpdateState } from "@heymoa/desktop-contracts";
import { showOnCurrentSpace } from "./show-window";
import { t, type Language } from "./i18n";

export type DesktopPreferencesView = {
  language: Language;
  opacity: number;
  update: DesktopUpdateState;
};
export type DesktopPreferencesAction =
  | "check"
  | "restart"
  | { action: "opacity"; value: number }
  | { action: "automatic"; value: boolean };
export function createDesktopPreferences(options: {
  read(): DesktopPreferencesView;
  action(value: DesktopPreferencesAction): Promise<void>;
}) {
  let window: BrowserWindow | null = null;
  let ready = false;
  let disposed = false;
  const file = path.join(__dirname, "preferences.html");
  const url = pathToFileURL(file).href;
  ipcMain.handle(
    "heymoa:preferences-action",
    async (event, payload: unknown) => {
      if (
        !window ||
        window.isDestroyed() ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame?.url !== url
      )
        throw new Error("UNTRUSTED_PREFERENCES_REQUEST");
      if (payload === "read") return options.read();
      if (payload !== "check" && payload !== "restart") {
        if (
          !payload ||
          typeof payload !== "object" ||
          Object.keys(payload).some((key) => !["action", "value"].includes(key))
        )
          throw new Error("INVALID_PREFERENCES_REQUEST");
        const { action, value } = payload as {
          action?: unknown;
          value?: unknown;
        };
        if (
          !(
            action === "opacity" &&
            typeof value === "number" &&
            Number.isFinite(value) &&
            value >= 0.6 &&
            value <= 1
          ) &&
          !(action === "automatic" && typeof value === "boolean")
        )
          throw new Error("INVALID_PREFERENCES_REQUEST");
      }
      await options.action(payload as DesktopPreferencesAction);
      return options.read();
    }
  );
  return {
    isOpen: () => Boolean(window && !window.isDestroyed()),
    show() {
      if (disposed) return;
      if (window && !window.isDestroyed()) {
        if (ready) showOnCurrentSpace(window);
        return;
      }
      const current = new BrowserWindow({
        width: 400,
        height: 580,
        show: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        autoHideMenuBar: true,
        title: t("데스크톱 설정"),
        backgroundColor: "#faf9f6",
        webPreferences: {
          preload: path.join(__dirname, "preferences-preload.js"),
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
          webSecurity: true,
          partition: "heymoa-preferences",
        },
      });
      window = current;
      const contents = current.webContents;
      const localRoot = pathToFileURL(__dirname + path.sep).href;
      contents.session.setPermissionRequestHandler(
        (_wc, _permission, callback) => callback(false)
      );
      contents.session.setPermissionCheckHandler(() => false);
      contents.session.webRequest.onBeforeRequest((details, callback) =>
        callback({ cancel: !details.url.startsWith(localRoot) })
      );
      contents.setWindowOpenHandler(() => ({ action: "deny" }));
      contents.on("will-navigate", (event) => event.preventDefault());
      contents.on("will-attach-webview", (event) => event.preventDefault());
      contents.on("render-process-gone", () => current.destroy());
      current.on("closed", () => {
        if (window === current) {
          window = null;
          ready = false;
        }
      });
      void current
        .loadFile(file)
        .then(() => {
          if (!disposed && window === current && !current.isDestroyed()) {
            ready = true;
            showOnCurrentSpace(current);
          }
        })
        .catch(() => { if (!current.isDestroyed()) current.destroy(); });
    },
    refresh() {
      if (!ready || !window || window.isDestroyed()) return;
      window.setTitle(t("데스크톱 설정"));
      window.webContents.send("heymoa:preferences-state", options.read());
    },
    dispose() {
      disposed = true;
      ipcMain.removeHandler("heymoa:preferences-action");
      if (window && !window.isDestroyed()) window.destroy();
      window = null;
    },
  };
}
