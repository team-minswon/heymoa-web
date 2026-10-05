import { app, BrowserWindow, dialog, Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import { isTrustedUrl, CHANNELS } from "./policy";
import {
  RecordingLifecycle,
  type QuitChoice,
  type QuitPrompt,
} from "./recording-lifecycle";

export function createRecordingTray(window: BrowserWindow, origin: string) {
  let allowQuit = false;
  let disposed = false;
  const image = nativeImage.createFromPath(
    path.join(
      __dirname,
      "../assets",
      process.platform === "darwin" ? "trayTemplate.png" : "tray.png"
    )
  );
  if (image.isEmpty()) throw new Error("MISSING_TRAY_IMAGE");
  image.setTemplateImage(process.platform === "darwin");
  const tray = new Tray(
    process.platform === "darwin"
      ? image
      : image.resize({ width: 32, height: 32 })
  );
  function show() {
    if (!disposed && !window.isDestroyed()) {
      window.show();
      window.focus();
    }
  }
  async function confirm(prompt: QuitPrompt): Promise<QuitChoice> {
    show();
    const discard = prompt === "discard";
    const waiting = prompt === "waiting";
    const result = await dialog.showMessageBox(window, {
      type: "warning",
      message: discard
        ? "전송되지 않은 소리를 버리고 앱을 종료하시겠습니까?"
        : waiting
          ? "녹음 종료와 전송 완료를 기다리고 있습니다."
          : "녹음이 진행 중이거나 전송되지 않은 소리가 있습니다.",
      detail: discard
        ? "아직 서버에 저장되지 않은 소리는 복구할 수 없습니다. 서버의 회의 완료를 의미하지 않습니다."
        : "앱을 유지하면 종료와 전송을 계속할 수 있습니다. 상태를 확인할 수 없는 경우에도 완료로 판단하지 않습니다.",
      buttons: discard
        ? ["취소", "소리를 버리고 앱 종료"]
        : waiting
          ? ["계속 기다리기", "앱 종료 취소", "소리를 버리고 종료…"]
          : ["취소", "녹음 종료 후 앱 종료", "소리를 버리고 종료…"],
      defaultId: 0,
      cancelId: discard ? 0 : waiting ? 1 : 0,
      noLink: true,
    });
    if (discard) return result.response === 1 ? "discard" : "cancel";
    if (waiting)
      return result.response === 0
        ? "wait"
        : result.response === 2
          ? "discard"
          : "cancel";
    return result.response === 1
      ? "wait"
      : result.response === 2
        ? "discard"
        : "cancel";
  }
  function refresh() {
    if (disposed) return;
    const view = lifecycle.view();
    const status = [
      view.label,
      view.elapsed && `시작 후 ${view.elapsed}`,
      view.pending && "전송 대기",
      view.inputWarning,
      view.waiting && "앱 종료 대기",
    ]
      .filter(Boolean)
      .join(" · ");
    tray.setToolTip(status);
    if (process.platform === "darwin")
      tray.setTitle(view.elapsed && !lifecycle.safe() ? view.elapsed : "", {
        fontType: "monospacedDigit",
      });
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: status, enabled: false },
        { type: "separator" },
        {
          label: "현재 회의 열기",
          click: () => {
            show();
            sendAction("show-current");
          },
        },
        {
          label: "녹음 종료",
          enabled: !view.unknown && !lifecycle.safe(),
          click: () => {
            show();
            sendAction("stop");
          },
        },
        { type: "separator" },
        { label: "앱 종료", click: () => void lifecycle.requestQuit() },
      ])
    );
  }
  function sendAction(action: "show-current" | "stop") {
    try {
      lifecycle.action(action);
    } catch {
      show();
    }
  }
  const lifecycle = new RecordingLifecycle({
    now: Date.now,
    confirm,
    action: (action) => {
      if (
        window.isDestroyed() ||
        window.webContents.isDestroyed() ||
        !isTrustedUrl(window.webContents.getURL(), origin)
      ) {
        lifecycle.unavailable();
        throw new Error("RECORDING_RENDERER_UNAVAILABLE");
      }
      window.webContents.send(CHANNELS.recordingAction, action);
    },
    quit: () => {
      allowQuit = true;
      app.quit();
    },
    changed: refresh,
    schedule: (callback, ms) => {
      const timer = setTimeout(callback, ms);
      return () => clearTimeout(timer);
    },
    notifyWaiting: () => {
      if (disposed || window.isDestroyed()) return;
      show();
      void dialog
        .showMessageBox(window, {
          type: "warning",
          message: "녹음 종료와 전송 완료를 아직 확인하지 못했습니다.",
          detail:
            "앱을 유지하고 현재 회의에서 상태를 확인해 주세요. 앱 종료 메뉴에서 종료 대기를 취소할 수 있습니다.",
          buttons: ["현재 회의 열기", "닫기"],
          defaultId: 0,
          cancelId: 1,
        })
        .then(({ response }) => {
          if (response === 0) show();
        })
        .catch(() => {});
    },
  });
  const close = (event: Electron.Event) => {
    if (!allowQuit) {
      event.preventDefault();
      window.hide();
    }
  };
  const beforeQuit = (event: Electron.Event) => {
    if (!allowQuit) {
      event.preventDefault();
      void lifecycle.requestQuit();
    }
  };
  const unavailable = () => lifecycle.unavailable();
  // Electron uses preventDefault here to override a renderer's beforeunload veto.
  // Only a safe exit or separately confirmed discard has authorized that override.
  const preventUnload = (event: Electron.Event) => {
    if (allowQuit) event.preventDefault();
  };
  const navigation = (
    _event: Electron.Event,
    _url: string,
    inPlace: boolean,
    mainFrame: boolean
  ) => {
    if (mainFrame && !inPlace && isTrustedUrl(_url, origin))
      lifecycle.unavailable();
  };
  const timer = setInterval(refresh, 1000);
  window.on("close", close);
  app.on("before-quit", beforeQuit);
  window.webContents.on("render-process-gone", unavailable);
  window.webContents.on("did-start-navigation", navigation);
  window.webContents.on("did-navigate", unavailable);
  window.webContents.on("will-prevent-unload", preventUnload);
  tray.on("double-click", show);
  refresh();
  return {
    lifecycle,
    dispose() {
      if (disposed) return;
      disposed = true;
      lifecycle.dispose();
      clearInterval(timer);
      window.removeListener("close", close);
      app.removeListener("before-quit", beforeQuit);
      window.webContents.removeListener("render-process-gone", unavailable);
      window.webContents.removeListener("did-start-navigation", navigation);
      window.webContents.removeListener("did-navigate", unavailable);
      window.webContents.removeListener("will-prevent-unload", preventUnload);
      tray.destroy();
    },
  };
}
