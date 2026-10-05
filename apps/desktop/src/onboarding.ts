import { BrowserWindow, ipcMain, shell, systemPreferences } from "electron";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const VERSION = 1;
export const ONBOARDING_CHANNEL = "heymoa:onboarding";
export type OnboardingAction =
  | "read"
  | "microphone"
  | "audio-settings"
  | "complete";
export type OnboardingView = {
  platform: "darwin" | "win32";
  microphone:
    | "not-determined"
    | "granted"
    | "denied"
    | "restricted"
    | "unknown";
};
const marker = (directory: string) => path.join(directory, "onboarding.json");

export async function onboardingCompleted(directory: string) {
  try {
    const value = JSON.parse(await readFile(marker(directory), "utf8"));
    return value?.version === VERSION && value?.completed === true;
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error as NodeJS.ErrnoException).code === "ENOENT"
    )
      return false;
    throw error;
  }
}

export function createOnboarding(directory: string) {
  const file = path.join(__dirname, "onboarding.html");
  const url = pathToFileURL(file).href;
  const current = new BrowserWindow({
    width: 720,
    height: 700,
    minWidth: 600,
    minHeight: 650,
    show: false,
    title: "HeyMoa 시작하기",
    backgroundColor: "#faf9f6",
    webPreferences: {
      preload: path.join(__dirname, "onboarding-preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      partition: "heymoa-onboarding",
    },
  });
  let busy = false;
  let disposed = false;
  let completed = false;
  let finish: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const contents = current.webContents;
  const localRoot = pathToFileURL(__dirname + path.sep).href;
  contents.session.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false)
  );
  contents.session.setPermissionCheckHandler(() => false);
  contents.session.webRequest.onBeforeRequest((details, callback) =>
    callback({ cancel: !details.url.startsWith(localRoot) })
  );
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event) => event.preventDefault());
  contents.on("will-attach-webview", (event) => event.preventDefault());
  const platform = process.platform === "darwin" ? "darwin" : "win32";
  function read(): OnboardingView {
    let microphone: OnboardingView["microphone"] = "unknown";
    try {
      const status = systemPreferences.getMediaAccessStatus("microphone");
      if (
        ["not-determined", "granted", "denied", "restricted"].includes(status)
      )
        microphone = status;
    } catch {
      /* OS status is unavailable, not approved. */
    }
    return { platform, microphone };
  }
  ipcMain.handle(ONBOARDING_CHANNEL, async (event, action: unknown) => {
    if (
      disposed ||
      completed ||
      current.isDestroyed() ||
      event.sender !== contents ||
      event.senderFrame !== contents.mainFrame ||
      event.senderFrame?.url !== url
    )
      throw new Error("UNTRUSTED_ONBOARDING_REQUEST");
    if (
      !["read", "microphone", "audio-settings", "complete"].includes(
        action as string
      )
    )
      throw new Error("INVALID_ONBOARDING_ACTION");
    if (action === "read") return read();
    if (busy) throw new Error("ONBOARDING_ACTION_PENDING");
    busy = true;
    try {
      if (action === "microphone") {
        const status = read().microphone;
        if (platform === "darwin" && status === "not-determined")
          await systemPreferences.askForMediaAccess("microphone");
        else if (status !== "granted")
          await shell.openExternal(
            platform === "darwin"
              ? "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
              : "ms-settings:privacy-microphone"
          );
      } else if (action === "audio-settings") {
        await shell.openExternal(
          platform === "darwin"
            ? "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
            : "ms-settings:sound"
        );
      } else if (action === "complete") {
        await mkdir(directory, { recursive: true });
        const temporary = marker(directory) + ".tmp";
        await writeFile(
          temporary,
          JSON.stringify({ version: VERSION, completed: true }),
          { mode: 0o600 }
        );
        await rename(temporary, marker(directory));
        completed = true;
        finish!();
      }
      return read();
    } finally {
      busy = false;
    }
  });
  current.on("ready-to-show", () => current.show());
  // Reload only the isolated introduction; never start capture or open the web on a crash.
  contents.on("render-process-gone", () => {
    if (!disposed && !current.isDestroyed())
      void current.loadFile(file).catch(() => current.close());
  });
  void current.loadFile(file).catch(() => current.close());
  return {
    finished,
    show() {
      if (!current.isDestroyed()) {
        current.show();
        current.focus();
      }
    },
    dispose() {
      disposed = true;
      ipcMain.removeHandler(ONBOARDING_CHANNEL);
      if (!current.isDestroyed()) current.destroy();
    },
  };
}
