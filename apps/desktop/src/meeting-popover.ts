import { BrowserWindow, ipcMain, screen, type Tray } from "electron";
import path from "node:path";
import { defaultPanelPreferences, type PanelPreferences } from "./preferences";
export type PanelOptions = {
  preferences: PanelPreferences;
  openSettings?(): void;
  save(value: PanelPreferences): Promise<void>;
};
import { pathToFileURL } from "node:url";
import {
  MEETING_CHANNELS,
  popoverBounds,
  loadingMeeting,
  type MeetingPopoverView,
} from "./meeting-timeline";

export function createMeetingPopover(
  tray: Tray,
  read: () => MeetingPopoverView,
  action: (
    value:
      | "stop"
      | "show-current"
      | "show-app"
      | "stop-viewing"
      | "list"
      | "show-recording"
      | "open-selection",
    tab?: "summary" | "transcript" | "context"
  ) => void,
  openNote: (noteId: string) => void = () => {},
  panel?: PanelOptions
) {
  let popup: BrowserWindow | null = null;
  let disposed = false;
  let ready = false;
  let visibleRequested = false;
  let preferences = { ...(panel?.preferences ?? defaultPanelPreferences) };
  let rememberedPosition = preferences.position;
  let positioning = false;
  let saving = Promise.resolve();
  let detailsRequested = false;
  let recordingSeen = false;
  let selectionSeen: number | undefined;
  let opening:
    | (import("@heymoa/desktop-contracts").ActiveMeeting & { at: number })
    | null = null;
  const view = () => {
    const current = read();
    if (
      (!current.selection && current.canStop && !recordingSeen) ||
      (current.selectionSource === "recording" &&
        current.selection?.requestId !== selectionSeen)
    ) {
      detailsRequested = true;
      opening = null;
    }
    recordingSeen = current.canStop;
    selectionSeen = current.selection?.requestId;
    let timeline = detailsRequested ? current.timeline : null;
    if (
      opening &&
      current.selection !== undefined &&
      current.selection?.noteId !== opening.noteId
    )
      opening = null;
    if (opening && timeline?.noteId === opening.noteId && !timeline.loading)
      opening = null;
    if (opening) {
      if (timeline?.noteId !== opening.noteId)
        timeline = loadingMeeting(opening);
      if (Date.now() - opening.at >= 30_000 || current.noteFailed)
        timeline = { ...timeline!, loading: false, failed: true };
    }
    return {
      ...current,
      timeline,
      viewing: detailsRequested && current.viewing,
      panel: { pinned: preferences.pinned, opacity: preferences.opacity },
    };
  };
  const publish = () => {
    if (ready && popup && !popup.isDestroyed())
      popup.webContents.send(MEETING_CHANNELS.changed, view());
  };
  function updatePreferences(patch: Partial<PanelPreferences>) {
    const next = saving
      .catch(() => {})
      .then(async () => {
        const updated = {
          ...preferences,
          position: rememberedPosition,
          ...patch,
        };
        await panel?.save(updated);
        preferences = updated;
        if (popup && !popup.isDestroyed())
          popup.setOpacity(preferences.opacity);
        publish();
      });
    saving = next;
    return next;
  }
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
    return view();
  });
  ipcMain.handle(MEETING_CHANNELS.action, (event, payload: unknown) => {
    authorized(event);
    if (
      payload !== null &&
      typeof payload === "object" &&
      (payload as { action?: unknown }).action === "set-panel"
    ) {
      const value = payload as { action: string; pinned?: unknown };
      if (
        Object.keys(value).some((key) => !["action", "pinned"].includes(key)) ||
        typeof value.pinned !== "boolean"
      )
        throw new Error("INVALID_MEETING_ACTION");
      return updatePreferences({ pinned: value.pinned });
    } else if (payload === "list") {
      detailsRequested = false;
      opening = null;
      action("list");
      publish();
    } else if (payload === "show-recording") {
      detailsRequested = true;
      opening = null;
      action("show-recording");
      publish();
    } else if (
      payload &&
      typeof payload === "object" &&
      (payload as { action?: unknown }).action === "open-selection"
    ) {
      const value = payload as { action: string; tab?: unknown };
      if (
        Object.keys(value).some((key) => !["action", "tab"].includes(key)) ||
        (value.tab !== "summary" &&
          value.tab !== "transcript" &&
          value.tab !== "context")
      )
        throw new Error("INVALID_MEETING_ACTION");
      hide();
      action("open-selection", value.tab);
    } else if (payload === "settings") {
      if (!preferences.pinned) hide();
      panel?.openSettings?.();
    } else if (payload === "hide") hide();
    else if (
      payload !== null &&
      typeof payload === "object" &&
      (payload as { action?: unknown }).action === "open-note" &&
      typeof (payload as { noteId?: unknown }).noteId === "string"
    ) {
      const target = read().meetings.find(
        (meeting) => meeting.noteId === (payload as { noteId: string }).noteId
      );
      if (
        !target ||
        Object.keys(payload as object).some(
          (key) => !["action", "noteId"].includes(key)
        )
      )
        throw new Error("INVALID_MEETING_ACTION");
      detailsRequested = true;
      opening = { ...target, at: Date.now() };
      openNote(target.noteId);
      position(popup!);
      publish();
    } else if (
      payload === "show-current" ||
      payload === "show-app" ||
      (payload === "stop" && read().canStop) ||
      (payload === "stop-viewing" && read().viewing)
    ) {
      // 보기 종료는 팝오버를 닫지 않는다 — 곧바로 진행 중 회의 목록이 보인다.
      if (payload === "show-current" || payload === "show-app") hide();
      action(payload);
    } else throw new Error("INVALID_MEETING_ACTION");
  });
  function position(current: BrowserWindow, restore = false) {
    const anchor = tray.getBounds();
    const height = 580;
    const remembered =
      restore && preferences.pinned ? rememberedPosition : undefined;
    const bounds = current.getBounds();
    const target = remembered
      ? { ...bounds, ...remembered }
      : restore
        ? anchor
        : bounds;
    const area = screen.getDisplayMatching(target).workArea;
    const size = {
      width: Math.min(420, area.width),
      height: Math.min(height, area.height),
    };
    const next =
      restore && !remembered
        ? { ...popoverBounds(anchor, area, height), ...size }
        : { ...target, ...size };
    next.x = Math.round(
      Math.max(area.x, Math.min(next.x, area.x + area.width - size.width))
    );
    next.y = Math.round(
      Math.max(area.y, Math.min(next.y, area.y + area.height - size.height))
    );
    positioning = true;
    if (
      bounds.x !== next.x ||
      bounds.y !== next.y ||
      bounds.width !== next.width ||
      bounds.height !== next.height
    )
      current.setBounds(next);
    positioning = false;
  }
  function displayChanged() {
    if (popup && !popup.isDestroyed()) position(popup);
  }
  screen.on("display-removed", displayChanged);
  screen.on("display-metrics-changed", displayChanged);
  function show(current: BrowserWindow) {
    if (disposed || !ready || !visibleRequested || current.isDestroyed())
      return;
    position(current, true);
    current.webContents.send(MEETING_CHANNELS.changed, view());
    current.show();
    current.focus();
  }
  function hide() {
    visibleRequested = false;
    if (popup && !popup.isDestroyed()) popup.hide();
  }
  const controller = {
    revealNote(noteId: string, title: string) {
      detailsRequested = true;
      const target = read().meetings.find(
        (meeting) => meeting.noteId === noteId
      );
      opening = target ? { ...target, title, at: Date.now() } : null;
      if (!visibleRequested) controller.toggle();
      else publish();
    },
    async setOpacity(opacity: number) {
      if (!Number.isFinite(opacity) || opacity < 0.6 || opacity > 1)
        throw new Error("INVALID_PANEL_REQUEST");
      await updatePreferences({ opacity });
      return preferences.opacity;
    },
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
      current.setOpacity(preferences.opacity);
      // 메뉴 막대를 누른 데스크탑(Space)에 뜨게 한다. 풀스크린 앱 위에서도 보이도록 pop-up-menu 레벨이다.
      if (
        process.platform === "darwin" &&
        typeof current.setVisibleOnAllWorkspaces === "function"
      ) {
        current.setVisibleOnAllWorkspaces(true, {
          visibleOnFullScreen: true,
          skipTransformProcessType: true,
        });
        current.setAlwaysOnTop(true, "pop-up-menu");
      }
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
      current.on("blur", () => {
        if (!preferences.pinned) hide();
      });
      current.on("moved", () => {
        if (positioning || current.isDestroyed()) return;
        const { x, y } = current.getBounds();
        rememberedPosition = { x, y };
        void updatePreferences({}).catch(() =>
          console.warn("Meeting panel position could not be saved")
        );
      });
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
      if (ready && popup && !popup.isDestroyed()) {
        position(popup);
        publish();
      }
    },
    hide,
    dispose() {
      if (disposed) return;
      disposed = true;
      screen.removeListener("display-removed", displayChanged);
      screen.removeListener("display-metrics-changed", displayChanged);
      ipcMain.removeHandler(MEETING_CHANNELS.read);
      ipcMain.removeHandler(MEETING_CHANNELS.action);
      if (popup && !popup.isDestroyed()) popup.destroy();
      popup = null;
    },
  };
  return controller;
}
