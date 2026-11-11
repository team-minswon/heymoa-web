import { getLanguage, isLanguage, t } from "./i18n";
import {
  loadLanguage,
  saveLanguage,
  loadAutomaticUpdates,
  saveAutomaticUpdates,
  loadPanelPreferences,
  savePanelPreferences,
  defaultPanelPreferences,
} from "./preferences";
import { autoUpdater } from "./update-runtime";
import { DesktopUpdates } from "./updates";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  shell,
  Menu,
} from "electron";
import path from "node:path";
import type { DesktopCapabilities } from "@heymoa/desktop-contracts";
import { createOnboarding, onboardingCompleted } from "./onboarding";
import { createRecordingTray } from "./recording-tray";
import { showOnCurrentSpace } from "./show-window";
import {
  MEETING_CHANNELS,
  activeMeetings,
  meetingTimeline,
} from "./meeting-timeline";
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
  sitePageUrl,
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

let panelPreferences = { ...defaultPanelPreferences };
let window: BrowserWindow | null = null;
let onboarding: ReturnType<typeof createOnboarding> | null = null;
let starting = true;
let origin: string;
let media: CaptureHost | null = null;
let recording: ReturnType<typeof createRecordingTray> | null = null;
let auth: DesktopAuthBroker | null = null;
let updates: DesktopUpdates | null = null;
let startupCallback: string | null = null;
function receiveCallback(value: string) {
  if (!nativeCallback(value)) return;
  if (!auth) startupCallback = value;
  else
    void auth.receive(value).then((accepted) => {
      if (accepted && window) {
        if (window.isMinimized()) window.restore();
        showOnCurrentSpace(window);
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
  if (onboarding) onboarding.show();
  else if (window) {
    if (window.isMinimized()) window.restore();
    showOnCurrentSpace(window);
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
function openSettings(section: "account" | "appUpdates" | "desktopAppearance") {
  if (!window || window.isDestroyed()) return;
  showOnCurrentSpace(window);
  if (isTrustedUrl(window.webContents.getURL(), origin))
    window.webContents.send("heymoa:open-settings", section);
}
function refreshApplicationMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === "darwin"
        ? [
            {
              label: "HeyMoa",
              submenu: [
                { role: "about" as const, label: t("HeyMoa 정보") },
                { type: "separator" as const },
                {
                  label: t("설정…"),
                  accelerator: "CmdOrCtrl+,",
                  click: () => openSettings("desktopAppearance"),
                },
                {
                  label: t("앱 업데이트…"),
                  click: () => openSettings("appUpdates"),
                },
                { type: "separator" as const },
                { role: "services" as const, label: t("서비스") },
                { type: "separator" as const },
                { role: "hide" as const, label: t("HeyMoa 가리기") },
                { role: "hideOthers" as const, label: t("다른 앱 가리기") },
                { role: "unhide" as const, label: t("모두 보기") },
                { type: "separator" as const },
                { role: "quit" as const, label: t("앱 종료") },
              ],
            },
          ]
        : []),
      {
        label: t("파일"),
        submenu: [
          ...(process.platform === "darwin"
            ? []
            : [
                {
                  label: t("설정…"),
                  accelerator: "CmdOrCtrl+,",
                  click: () => openSettings("desktopAppearance"),
                },
                {
                  label: t("앱 업데이트…"),
                  click: () => openSettings("appUpdates"),
                },
                { type: "separator" as const },
              ]),
          { role: "close", label: t("창 닫기") },
          ...(process.platform === "darwin"
            ? []
            : [{ role: "quit" as const, label: t("앱 종료") }]),
        ],
      },
      {
        label: t("편집"),
        submenu: [
          { role: "undo", label: t("실행 취소") },
          { role: "redo", label: t("다시 실행") },
          { type: "separator" },
          { role: "cut", label: t("오려두기") },
          { role: "copy", label: t("복사") },
          { role: "paste", label: t("붙여넣기") },
          { role: "selectAll", label: t("전체 선택") },
        ],
      },
      {
        label: t("보기"),
        submenu: [
          { role: "reload", label: t("다시 불러오기") },
          { role: "resetZoom", label: t("확대/축소 재설정") },
          { role: "zoomIn", label: t("확대") },
          { role: "zoomOut", label: t("축소") },
          { role: "togglefullscreen", label: t("전체 화면") },
        ],
      },
      {
        label: t("윈도우"),
        submenu: [
          { role: "minimize", label: t("최소화") },
          { role: "front", label: t("맨 앞으로 가져오기") },
        ],
      },
    ])
  );
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
  recording = createRecordingTray(
    current,
    origin,
    () => updates?.onQuit() ?? false,
    {
      preferences: panelPreferences,
      save: async (value) => {
        await savePanelPreferences(userDataPath, value);
        panelPreferences = value;
      },
      openSettings,
    }
  );
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
        message: t("앱 화면이 중단되었습니다."),
        detail: t(
          "녹음 중이었다면 아직 전송되지 않은 소리는 사라질 수 있습니다."
        ),
        buttons: [t("다시 열기"), t("앱 종료")],
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
      message: t("HeyMoa에 연결하지 못했습니다."),
      detail: t("인터넷 연결을 확인한 뒤 다시 시도해 주세요."),
      buttons: [t("다시 시도"), t("앱 종료")],
    });
    if (response === 0 && !current.isDestroyed()) void load(current, url);
    else app.quit();
  }
}
app
  .whenReady()
  .then(async () => {
    if (!ownsInstance) return;
    const storedLanguage = await loadLanguage(userDataPath, app.getLocale());
    const support = platformSupport(
      process.platform,
      process.arch,
      process.getSystemVersion()
    );
    if (!support.supported) {
      dialog.showErrorBox(t("지원하지 않는 환경"), support.reason!);
      app.quit();
      return;
    }
    let url: string;
    try {
      url = applicationUrl(app.isPackaged, process.env.HEYMOA_DESKTOP_DEV_URL);
    } catch {
      dialog.showErrorBox(
        t("개발 URL 오류"),
        t("loopback 개발 URL을 확인해 주세요.")
      );
      app.quit();
      return;
    }
    origin = new URL(url).origin;
    // Native authentication uses the same persistent cookie jar as the web
    // window. Requests stay on the fixed API origin and never follow redirects.
    const jar = session.fromPartition("persist:heymoa");
    const cookies = await jar.cookies.get({ url, name: "heymoa-lang" });
    if (!storedLanguage && isLanguage(cookies[0]?.value))
      await saveLanguage(userDataPath, cookies[0].value);
    refreshApplicationMenu();
    auth = new DesktopAuthBroker({
      apiOrigin: PRODUCTION_API_ORIGIN,
      language: getLanguage,
      post: authPost((value, options) => jar.fetch(value, options), origin),
      openBrowser: (value) => shell.openExternal(value),
    });
    if (app.isPackaged) app.setAsDefaultProtocolClient("app.heymoa");
    else if (process.argv[1])
      app.setAsDefaultProtocolClient("app.heymoa", process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    const safeForUpdate = () =>
      Boolean(
        window &&
        !window.isDestroyed() &&
        isTrustedUrl(window.webContents.getURL(), origin) &&
        !media &&
        recording?.lifecycle.safeForUpdate()
      );
    panelPreferences = await loadPanelPreferences(userDataPath);
    updates = new DesktopUpdates(autoUpdater, {
      currentVersion: app.getVersion(),
      available: app.isPackaged,
      automatic: await loadAutomaticUpdates(userDataPath),
      safe: safeForUpdate,
      prepareInstall: () =>
        safeForUpdate() && (recording?.prepareForUpdate() ?? false),
      cancelInstall: () => recording?.cancelUpdate(),
      saveAutomatic: (enabled) => saveAutomaticUpdates(userDataPath, enabled),
      changed: (state) => {
        if (
          window &&
          !window.isDestroyed() &&
          isTrustedUrl(window.webContents.getURL(), origin)
        )
          window.webContents.send("heymoa:update-state", state);
      },
    });
    updates.start();
    app.on("will-quit", () => updates?.dispose());
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
        updates: true,
      } satisfies DesktopCapabilities;
    });
    ipcMain.handle("heymoa:panel-opacity", (event, payload: unknown) => {
      authorize(event);
      if (!emptyRequest(payload)) throw new Error("INVALID_PANEL_REQUEST");
      return panelPreferences.opacity;
    });
    ipcMain.handle("heymoa:panel-opacity-set", (event, payload: unknown) => {
      authorize(event);
      if (
        typeof payload !== "number" ||
        !Number.isFinite(payload) ||
        payload < 0.6 ||
        payload > 1 ||
        !recording
      )
        throw new Error("INVALID_PANEL_REQUEST");
      return recording.setPanelOpacity(payload);
    });
    ipcMain.handle("heymoa:update-state", (event, payload: unknown) => {
      authorize(event);
      if (!emptyRequest(payload)) throw new Error("INVALID_UPDATE_REQUEST");
      return updates!.state();
    });
    ipcMain.handle("heymoa:update-check", (event, payload: unknown) => {
      authorize(event);
      if (!emptyRequest(payload)) throw new Error("INVALID_UPDATE_REQUEST");
      // Results and progress arrive over the subscription, without holding the UI for the whole download.
      void updates!.check();
      return updates!.state();
    });
    ipcMain.handle("heymoa:update-automatic", (event, payload: unknown) => {
      authorize(event);
      if (typeof payload !== "boolean")
        throw new Error("INVALID_UPDATE_REQUEST");
      return updates!.setAutomatic(payload);
    });
    ipcMain.handle("heymoa:update-restart", (event, payload: unknown) => {
      authorize(event);
      if (!emptyRequest(payload)) throw new Error("INVALID_UPDATE_REQUEST");
      return updates!.restart();
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
    ipcMain.handle("heymoa:open-site-page", (event, value: unknown) => {
      authorize(event);
      const safe = sitePageUrl(value, origin);
      if (!safe) throw new Error("INVALID_SITE_PAGE");
      return shell.openExternal(safe);
    });
    ipcMain.handle("heymoa:language", async (event, value: unknown) => {
      authorize(event);
      if (!isLanguage(value)) throw new Error("INVALID_LANGUAGE");
      await saveLanguage(userDataPath, value);
      refreshApplicationMenu();
      recording?.refresh();
    });
    ipcMain.handle(CHANNELS.summary, (event, payload: unknown) => {
      authorize(event);
      const summary = recordingSummary(payload);
      // 녹음이 끝나며 지우는 일은 트레이가 상태 전이에서 한다. 뷰어 타임라인은 여기서 지우지 않는다.
      recording?.lifecycle.update(summary);
      updates?.publish();
    });
    ipcMain.handle(MEETING_CHANNELS.report, (event, payload: unknown) => {
      authorize(event);
      recording?.reportTimeline(meetingTimeline(payload));
    });
    ipcMain.handle(
      MEETING_CHANNELS.activeMeetings,
      (event, payload: unknown) => {
        authorize(event);
        recording?.reportActiveMeetings(activeMeetings(payload));
      }
    );
    ipcMain.handle(CHANNELS.captureBegin, async (event, payload: unknown) => {
      authorize(event);
      if (!emptyRequest(payload) || !event.senderFrame)
        throw new Error("INVALID_CAPTURE_REQUEST");
      if (updates?.state().status === "installing")
        throw new Error("UPDATE_INSTALLING");
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
    app.on("activate", () => {
      if (onboarding) onboarding.show();
      else if (starting) return;
      else if (!window) createWindow(url);
      else showOnCurrentSpace(window);
    });
    if (!(await onboardingCompleted(userDataPath))) {
      onboarding = createOnboarding(userDataPath, refreshApplicationMenu, {
        automatic: updates!.state().automatic,
        save: (enabled) => updates!.setAutomatic(enabled),
      });
      await onboarding.finished;
    }
    if (onboarding || !cookies.length)
      await jar.cookies.set({
        url: origin,
        name: "heymoa-lang",
        value: getLanguage(),
        path: "/",
        sameSite: "lax",
        secure: origin.startsWith("https:"),
        expirationDate: Date.now() / 1000 + 365 * 86400,
      });
    const initial = new URL(url);
    if (initial.pathname === "/" && getLanguage() === "en") {
      initial.pathname = "/en";
      url = initial.href;
    }
    createWindow(url);
    starting = false;
    onboarding?.dispose();
    onboarding = null;
    if (startupCallback) {
      receiveCallback(startupCallback);
      startupCallback = null;
    }
  })
  .catch(() => {
    dialog.showErrorBox(t("시작 실패"), t("HeyMoa를 시작하지 못했습니다."));
    app.quit();
  });
app.on("window-all-closed", () => app.quit());
// before-quit can be vetoed by recording protection; keep pending auth alive
// until Electron has committed to exiting.
app.on("will-quit", () => {
  auth?.cancel();
  onboarding?.dispose();
});
