import { app, BrowserWindow, dialog, ipcMain, session, shell } from "electron";
import path from "node:path";
import type { DesktopCapabilities } from "@heymoa/desktop-contracts";
import { createRecordingTray } from "./recording-tray";
import { MEETING_CHANNELS, meetingTimeline } from "./meeting-timeline";
import { captureId } from "./media-grant";
import { CaptureHost } from "./capture-host";
import { CAPTURE_ACK } from "./capture-protocol";
import { DesktopAuthBroker } from "./auth";
import { authPost } from "./auth-session";
import {
  nativeCallback,
  PRODUCTION_API_ORIGIN,
  connectionRequest,
} from "./auth-policy";
import { onDocumentReplacement, secureContents } from "./security";
import {
  applicationUrl,
  BRIDGE_VERSION,
  CHANNELS,
  emptyRequest,
  externalUrl,
  platformSupport,
  recordingSummary,
  trustedSender,
  isTrustedUrl,
} from "./policy";

// Menu labels use Electron's internal name. Preserve existing profiles before
// changing it so the instance lock and persistent cookies keep their addresses.
const userDataPath = app.getPath("userData");
const sessionDataPath = app.getPath("sessionData");
app.setName("HeyMoa");
app.setPath("userData", userDataPath);
app.setPath("sessionData", sessionDataPath);

let window: BrowserWindow | null = null;
let origin: string;
let media: CaptureHost | null = null;
let recording: ReturnType<typeof createRecordingTray> | null = null;
let auth: DesktopAuthBroker | null = null;
let startupCallback: string | null = null;
function receiveCallback(value: string) {
  if (!nativeCallback(value)) return;
  if (!auth) startupCallback = value;
  else
    void auth.receive(value).then((accepted) => {
      if (accepted && window) {
        if (window.isMinimized()) window.restore();
        window.show();
        window.focus();
      }
    });
}
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
app.on("open-url", (event, value) => {
  event.preventDefault();
  receiveCallback(value);
});
app.on("second-instance", (_event, argv) => {
  for (const value of argv) receiveCallback(value);
  if (window) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
});
for (const value of process.argv) receiveCallback(value);
function openExternal(value: string) {
  const safe = externalUrl(value, origin);
  if (safe)
    void shell
      .openExternal(safe)
      .catch(() => console.warn("External link could not be opened"));
}
function createWindow(url: string) {
  const current = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      partition: "persist:heymoa",
    },
  });
  window = current;
  const contents = current.webContents;
  secureContents(contents, origin, openExternal);
  recording = createRecordingTray(current, origin);
  contents.on("did-start-navigation", (event) => {
    if (
      event.isMainFrame &&
      !event.isSameDocument &&
      isTrustedUrl(event.url, origin)
    ) {
      media?.dispose();
      media = null;
    }
  });
  contents.on("did-navigate", () => {
    media?.dispose();
    media = null;
  });
  contents.on("render-process-gone", () => {
    media?.dispose();
    media = null;
  });
  contents.on("destroyed", () => {
    media?.dispose();
    media = null;
  });
  current.on("ready-to-show", () => current.show());
  current.on("closed", () => {
    recording?.dispose();
    recording = null;
    auth?.cancel();
    if (window === current) window = null;
  });
  onDocumentReplacement(contents, origin, () => auth?.cancel());
  contents.on("render-process-gone", () => {
    auth?.cancel();
    void dialog
      .showMessageBox(current, {
        type: "error",
        message: "앱 화면이 중단되었습니다.",
        detail: "녹음 중이었다면 아직 전송되지 않은 소리는 사라질 수 있습니다.",
        buttons: ["다시 열기", "앱 종료"],
      })
      .then(({ response }) => {
        if (response === 0 && !current.isDestroyed()) void load(current, url);
        else app.quit();
      });
  });
  void load(current, url);
}
async function load(current: BrowserWindow, url: string) {
  try {
    await current.loadURL(url);
  } catch {
    if (current.isDestroyed()) return;
    current.show();
    const { response } = await dialog.showMessageBox(current, {
      type: "error",
      message: "HeyMoa에 연결하지 못했습니다.",
      detail: "인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
      buttons: ["다시 시도", "앱 종료"],
    });
    if (response === 0 && !current.isDestroyed()) void load(current, url);
    else app.quit();
  }
}
app
  .whenReady()
  .then(async () => {
    if (!ownsInstance) return;
    const support = platformSupport(
      process.platform,
      process.arch,
      process.getSystemVersion()
    );
    if (!support.supported) {
      dialog.showErrorBox("지원하지 않는 환경", support.reason!);
      app.quit();
      return;
    }
    let url: string;
    try {
      url = applicationUrl(app.isPackaged, process.env.HEYMOA_DESKTOP_DEV_URL);
    } catch {
      dialog.showErrorBox(
        "개발 URL 오류",
        "loopback 개발 URL을 확인해 주세요."
      );
      app.quit();
      return;
    }
    origin = new URL(url).origin;
    // Native authentication uses the same persistent cookie jar as the web
    // window. Requests stay on the fixed API origin and never follow redirects.
    const jar = session.fromPartition("persist:heymoa");
    auth = new DesktopAuthBroker({
      apiOrigin: PRODUCTION_API_ORIGIN,
      post: authPost((value, options) => jar.fetch(value, options), origin),
      openBrowser: (value) => shell.openExternal(value),
    });
    if (app.isPackaged) app.setAsDefaultProtocolClient("app.heymoa");
    else if (process.argv[1])
      app.setAsDefaultProtocolClient("app.heymoa", process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    function authorize(event: Electron.IpcMainInvokeEvent) {
      if (
        !window ||
        !trustedSender(
          event.sender,
          window.webContents,
          event.senderFrame,
          window.webContents.mainFrame,
          event.senderFrame?.url ?? "",
          origin
        )
      )
        throw new Error("UNTRUSTED_DESKTOP_REQUEST");
    }
    ipcMain.handle(CHANNELS.capabilities, (event, payload: unknown) => {
      authorize(event);
      if (!emptyRequest(payload)) throw new Error("INVALID_CAPABILITY_REQUEST");
      return {
        bridgeVersion: BRIDGE_VERSION,
        platform: process.platform,
        architecture: process.arch,
        supported: support.supported,
        capture: true,
        captureContractVersion: 1,
        login: true,
        connectionOAuth: true,
        meetingTimeline: true,
      } satisfies DesktopCapabilities;
    });
    ipcMain.handle("heymoa:auth-login", (event, payload: unknown) => {
      authorize(event);
      if (!emptyRequest(payload)) throw new Error("INVALID_AUTH_REQUEST");
      return auth!.begin();
    });
    ipcMain.handle("heymoa:auth-connection", (event, payload: unknown) => {
      authorize(event);
      return auth!.begin(connectionRequest(payload));
    });
    ipcMain.handle("heymoa:auth-cancel", (event, payload: unknown) => {
      authorize(event);
      if (!emptyRequest(payload)) throw new Error("INVALID_AUTH_REQUEST");
      auth!.cancel();
    });
    ipcMain.handle(CHANNELS.summary, (event, payload: unknown) => {
      authorize(event);
      const summary = recordingSummary(payload);
      if (summary.phase !== "recording") recording?.clearTimeline();
      recording?.lifecycle.update(summary);
    });
    ipcMain.handle(MEETING_CHANNELS.report, (event, payload: unknown) => {
      authorize(event);
      recording?.reportTimeline(meetingTimeline(payload));
    });
    ipcMain.handle(CHANNELS.captureBegin, async (event, payload: unknown) => {
      authorize(event);
      if (!emptyRequest(payload) || !event.senderFrame)
        throw new Error("INVALID_CAPTURE_REQUEST");
      if (media) throw new Error("CAPTURE_ALREADY_REQUESTED");
      recording?.lifecycle.captureRequested();
      const host = new CaptureHost(event.sender, event.senderFrame, () => {
        if (media === host) {
          media = null;
          recording?.lifecycle.captureDisposed();
        }
      });
      media = host;
      try {
        return await host.acquire();
      } catch (error) {
        if (media === host) {
          media = null;
          recording?.lifecycle.captureDisposed();
        }
        throw error;
      }
    });
    ipcMain.handle(CHANNELS.captureReady, async (event, payload: unknown) => {
      authorize(event);
      if (!media) throw new Error("CAPTURE_NOT_READY");
      await media.start(captureId(payload));
    });
    ipcMain.handle(CHANNELS.captureEnd, async (event, payload: unknown) => {
      authorize(event);
      if (
        payload === undefined
          ? media?.acquiring
          : media?.id === captureId(payload)
      ) {
        const current = media;
        if (payload === undefined) current?.dispose();
        else await current?.stop(payload as string);
        if (media === current) media = null;
      }
    });
    ipcMain.on(CAPTURE_ACK, (event, payload: unknown) => {
      try {
        authorize(event);
        if (!payload || typeof payload !== "object") return;
        const ack = payload as { id: unknown; sequence: unknown };
        if (
          Object.keys(ack).sort().join(",") !== "id,sequence" ||
          !Number.isSafeInteger(ack.sequence)
        )
          return;
        media?.ack(captureId(ack.id), ack.sequence as number);
      } catch {
        /* Untrusted or stale acknowledgment. */
      }
    });
    createWindow(url);
    if (startupCallback) {
      receiveCallback(startupCallback);
      startupCallback = null;
    }
    app.on("activate", () => {
      if (!window) createWindow(url);
      else window.show();
    });
  })
  .catch(() => {
    dialog.showErrorBox("시작 실패", "HeyMoa를 시작하지 못했습니다.");
    app.quit();
  });
app.on("window-all-closed", () => app.quit());
// before-quit can be vetoed by recording protection; keep pending auth alive
// until Electron has committed to exiting.
app.on("will-quit", () => auth?.cancel());
