import { app, BrowserWindow, dialog, Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import type {
  ActiveMeeting,
  MeetingTimelineSnapshot,
} from "@heymoa/desktop-contracts";
import { createMeetingPopover } from "./meeting-popover";
import { showOnCurrentSpace } from "./show-window";
import {
  ACTIVE_MEETINGS_STALE_MS,
  MEETING_CHANNELS,
  TIMELINE_STALE_MS,
} from "./meeting-timeline";
import { isTrustedUrl, CHANNELS } from "./policy";
import {
  RecordingLifecycle,
  type QuitChoice,
  type QuitPrompt,
} from "./recording-lifecycle";

const VIEWING_LABEL = "회의 보는 중";

export function createRecordingTray(window: BrowserWindow, origin: string) {
  // BrowserWindow.webContents throws after closed; keep the live reference for cleanup.
  const contents = window.webContents;
  let allowQuit = false;
  let disposed = false;
  let timeline: MeetingTimelineSnapshot | null = null;
  let timelineAt = 0;
  let meetings: ActiveMeeting[] = [];
  let meetingsAt = 0;
  let contextMenu: Menu | null = null;
  let throttled: boolean | undefined;
  let wasRecording = false;
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
      showOnCurrentSpace(window);
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
  /** 뷰어로 보는 회의의 경과. 시작 시각은 진행 중 회의 목록에서 찾는다(APP-1094). */
  function viewElapsed(): string | null {
    if (!timeline || lifecycle.isRecording()) return null;
    const start = meetings.find((m) => m.noteId === timeline!.noteId)?.startedAt;
    if (start === null || start === undefined) return null;
    const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function refresh() {
    if (disposed) return;
    const recording = lifecycle.isRecording();
    // 녹음이 끝나면 그때까지 받은 타임라인은 내 녹음의 것이다. 뷰어로 계속 보면 웹이 다시 보낸다.
    if (wasRecording && !recording) clearTimeline();
    wasRecording = recording;
    // 뷰어 타임라인은 웹이 10초마다 다시 보낸다. 그 두 배가 지나도 안 오면 그만 본다.
    if (!recording && timeline && Date.now() - timelineAt > TIMELINE_STALE_MS * 2)
      clearTimeline();
    if (meetings.length && Date.now() - meetingsAt > ACTIVE_MEETINGS_STALE_MS)
      meetings = [];
    const viewing = !recording && timeline !== null;
    // 숨은 창이 느려지면 타임라인 하트비트와 실시간 이벤트가 늦는다. 보는 동안도 켜 둔다.
    const backgroundThrottling = !recording && !viewing;
    if (!contents.isDestroyed() && throttled !== backgroundThrottling) {
      // Keep the hidden recording window's timeline heartbeat and realtime events active.
      contents.setBackgroundThrottling(backgroundThrottling);
      throttled = backgroundThrottling;
    }
    const view = lifecycle.view();
    const elapsed = viewing ? viewElapsed() : view.elapsed;
    const status = [
      viewing ? VIEWING_LABEL : view.label,
      elapsed && `시작 후 ${elapsed}`,
      view.pending && "전송 대기",
      view.inputWarning,
      view.waiting && "앱 종료 대기",
    ]
      .filter(Boolean)
      .join(" · ");
    tray.setToolTip(status);
    if (process.platform === "darwin")
      tray.setTitle(elapsed && (viewing || !lifecycle.safe()) ? elapsed : "", {
        fontType: "monospacedDigit",
      });
    contextMenu = Menu.buildFromTemplate([
      { label: status, enabled: false },
      { type: "separator" },
      {
        label:
          view.phase !== null && view.phase !== "idle"
            ? "현재 회의 열기"
            : "HeyMoa 열기",
        click: () => {
          sendAction("show-current");
        },
      },
      {
        label: "녹음 중지",
        enabled: lifecycle.isRecording(),
        click: () => {
          sendAction("stop");
        },
      },
      { type: "separator" },
      { label: "앱 종료", click: () => void lifecycle.requestQuit() },
    ]);
    popover?.refresh();
  }
  function sendAction(action: "show-current" | "stop") {
    // A menu may have been built before the latest phase update.
    if (action === "stop" && !lifecycle.isRecording()) return;
    try {
      if (action === "show-current") show();
      // 뷰어로 보는 회의는 창이 이미 그 노트에 있다. 이전 녹음 노트로 보내지 않는다.
      if (action === "show-current" && timeline && !lifecycle.isRecording())
        return;
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
        contents.isDestroyed() ||
        !isTrustedUrl(contents.getURL(), origin)
      ) {
        lifecycle.unavailable();
        throw new Error("RECORDING_RENDERER_UNAVAILABLE");
      }
      contents.send(CHANNELS.recordingAction, action);
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
  const popover = createMeetingPopover(
    tray,
    () => {
      const view = lifecycle.view();
      return {
        phase: view.phase,
        unknown: view.unknown,
        timeline,
        meetings,
        label: !lifecycle.isRecording() && timeline ? VIEWING_LABEL : view.label,
        elapsed: viewElapsed() ?? view.elapsed,
        warning:
          view.inputWarning ||
          (view.pending ? "전송 대기 중인 소리가 있습니다." : null),
        canStop: lifecycle.isRecording(),
        stale: timeline !== null && Date.now() - timelineAt > TIMELINE_STALE_MS,
      };
    },
    sendAction,
    openNote
  );
  /** 팝오버가 목록에 있던 회의를 눌렀다. 목록에 없는 id 는 받지 않는다. */
  function openNote(noteId: string) {
    const target = meetings.find((meeting) => meeting.noteId === noteId);
    if (!target || disposed) return;
    try {
      show();
      if (
        window.isDestroyed() ||
        contents.isDestroyed() ||
        !isTrustedUrl(contents.getURL(), origin)
      )
        throw new Error("RECORDING_RENDERER_UNAVAILABLE");
      contents.send(MEETING_CHANNELS.openNote, {
        workspaceId: target.workspaceId,
        noteId: target.noteId,
      });
    } catch {
      show();
    }
  }
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
  const clearTimeline = () => {
    timeline = null;
    timelineAt = 0;
    popover.refresh();
  };
  const unavailable = () => {
    clearTimeline();
    meetings = [];
    popover.refresh();
    lifecycle.unavailable();
  };
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
    if (mainFrame && !inPlace && isTrustedUrl(_url, origin)) unavailable();
  };
  const timer = setInterval(refresh, 1000);
  window.on("close", close);
  app.on("before-quit", beforeQuit);
  contents.on("render-process-gone", unavailable);
  contents.on("did-start-navigation", navigation);
  contents.on("did-navigate", unavailable);
  contents.on("will-prevent-unload", preventUnload);
  tray.on("double-click", show);
  const togglePopover = () => popover.toggle();
  const showMenu = () => {
    if (contextMenu) tray.popUpContextMenu(contextMenu);
  };
  tray.on("click", togglePopover);
  tray.on("right-click", showMenu);
  refresh();
  return {
    lifecycle,
    reportTimeline(value: MeetingTimelineSnapshot | null) {
      // 녹음 중이 아니어도 받는다 — 내가 뷰어로 보는 진행 중 회의다(APP-1092).
      timeline = value;
      timelineAt = Date.now();
      popover.refresh();
    },
    reportActiveMeetings(value: ActiveMeeting[]) {
      meetings = value;
      meetingsAt = Date.now();
      popover.refresh();
    },
    clearTimeline,
    dispose() {
      if (disposed) return;
      disposed = true;
      lifecycle.dispose();
      clearTimeline();
      popover.dispose();
      clearInterval(timer);
      window.removeListener("close", close);
      app.removeListener("before-quit", beforeQuit);
      contents.removeListener("render-process-gone", unavailable);
      contents.removeListener("did-start-navigation", navigation);
      contents.removeListener("did-navigate", unavailable);
      contents.removeListener("will-prevent-unload", preventUnload);
      tray.removeListener("click", togglePopover);
      tray.removeListener("right-click", showMenu);
      tray.removeListener("double-click", show);
      tray.destroy();
    },
  };
}
