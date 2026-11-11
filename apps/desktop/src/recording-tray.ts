import { formatElapsed, getLanguage, t } from "./i18n";
import { app, BrowserWindow, dialog, Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import type {
  ActiveMeeting,
  MeetingTimelineSnapshot,
  MeetingListSnapshot,
  MeetingTarget,
} from "@heymoa/desktop-contracts";
import { createMeetingPopover } from "./meeting-popover";
import { showOnCurrentSpace } from "./show-window";
import {
  ACTIVE_MEETINGS_STALE_MS,
  MEETING_CHANNELS,
  TIMELINE_STALE_MS,
  loadingMeeting,
} from "./meeting-timeline";
import { isTrustedUrl, CHANNELS } from "./policy";
import {
  RecordingLifecycle,
  type QuitChoice,
  type QuitPrompt,
} from "./recording-lifecycle";

const VIEWING_LABEL = "회의 보는 중";

export function createRecordingTray(
  window: BrowserWindow,
  origin: string,
  onQuit?: () => boolean,
  panel?: import("./meeting-popover").PanelOptions
) {
  // BrowserWindow.webContents throws after closed; keep the live reference for cleanup.
  const contents = window.webContents;
  let allowQuit = false;
  let disposed = false;
  let timeline: MeetingTimelineSnapshot | null = null;
  let timelineAt = 0;
  let meetings: ActiveMeeting[] = [];
  let meetingsAt = 0;
  let meetingsStatus: MeetingListSnapshot["status"] = "loading";
  let noteFailed = false;
  let selection: MeetingTarget | null = null;
  let selectionSource: "recording" | "browse" | null = null;
  let recordingTarget: MeetingTarget | null = null;
  let listWorkspaceId: string | null = null;
  let selectionSequence = 0;
  let unavailableSelection: number | null = null;
  function selectMeeting(
    target: MeetingTarget | null,
    source: "recording" | "browse" | null = null
  ) {
    selection = target ? { ...target, requestId: ++selectionSequence } : null;
    selectionSource = target ? source : null;
    unavailableSelection = null;
    if (!contents.isDestroyed() && isTrustedUrl(contents.getURL(), origin))
      contents.send(MEETING_CHANNELS.selection, selection);
  }
  function chooseMeeting(
    target: MeetingTarget,
    source: "recording" | "browse"
  ) {
    selectMeeting(target, source);
    noteFailed = false;
    const row = meetings.find((meeting) => meeting.noteId === target.noteId);
    timeline = loadingMeeting(
      row ?? { ...target, title: t("진행 중인 회의"), state: "IN_PROGRESS" },
      selection!.requestId,
      recordingTarget?.noteId === target.noteId
    );
    timelineAt = Date.now();
    popover.refresh();
  }
  let contextMenu: Menu | null = null;
  let throttled: boolean | undefined;
  let wasRecording = false;
  /** 로그인 시 자동 실행. 설치된 앱에서만 다룬다(개발 중 electron 바이너리를 등록하지 않는다). */
  const loginItemSupported =
    app.isPackaged === true &&
    typeof app.getLoginItemSettings === "function" &&
    typeof app.setLoginItemSettings === "function";
  /** Windows 는 작업 관리자에서 시작 프로그램을 꺼도 등록은 남는다. 실제로 실행될지를 본다. */
  const readOpenAtLogin = () => {
    const settings = app.getLoginItemSettings();
    return settings.executableWillLaunchAtLogin ?? settings.openAtLogin;
  };
  let openAtLogin = loginItemSupported ? readOpenAtLogin() : false;
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
        ? t("전송되지 않은 소리를 버리고 앱을 종료하시겠습니까?")
        : waiting
          ? t("녹음 종료와 전송 완료를 기다리고 있습니다.")
          : t("녹음이 진행 중이거나 전송되지 않은 소리가 있습니다."),
      detail: discard
        ? t(
            "아직 서버에 저장되지 않은 소리는 복구할 수 없습니다. 서버의 회의 완료를 의미하지 않습니다."
          )
        : t(
            "앱을 유지하면 종료와 전송을 계속할 수 있습니다. 상태를 확인할 수 없는 경우에도 완료로 판단하지 않습니다."
          ),
      buttons: discard
        ? [t("취소"), t("소리를 버리고 앱 종료")]
        : waiting
          ? [t("계속 기다리기"), t("앱 종료 취소"), t("소리를 버리고 종료…")]
          : [t("취소"), t("녹음 종료 후 앱 종료"), t("소리를 버리고 종료…")],
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
    if (
      timeline.detail?.meetingState &&
      timeline.detail.meetingState !== "IN_PROGRESS"
    )
      return null;
    const start = meetings.find(
      (m) => m.noteId === timeline!.noteId
    )?.startedAt;
    if (start === null || start === undefined) return null;
    const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
    return formatElapsed(seconds);
  }
  function refresh() {
    if (disposed) return;
    const recording = lifecycle.isRecording();
    // 녹음이 끝나면 그때까지 받은 타임라인은 내 녹음의 것이다. 뷰어로 계속 보면 웹이 다시 보낸다.
    if (wasRecording && !recording && !timeline?.detail) clearTimeline();
    wasRecording = recording;
    // 뷰어 타임라인은 웹이 10초마다 다시 보낸다. 그 두 배가 지나도 안 오면 그만 본다.
    if (
      !recording &&
      timeline &&
      !timeline.detail &&
      !selection &&
      Date.now() - timelineAt > TIMELINE_STALE_MS * 2
    )
      clearTimeline();
    if (meetings.length && Date.now() - meetingsAt > ACTIVE_MEETINGS_STALE_MS) {
      meetings = [];
      meetingsStatus = "failed";
    }
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
      viewing ? t(VIEWING_LABEL) : view.label,
      elapsed &&
        (getLanguage() === "en" ? `${elapsed} elapsed` : `시작 후 ${elapsed}`),
      view.pending &&
        !["recording", "stopping"].includes(view.phase ?? "") &&
        t("전송 대기"),
      view.inputWarning,
      view.waiting && t("앱 종료 대기"),
    ]
      .filter(Boolean)
      .join(" · ");
    tray.setToolTip(status);
    if (process.platform === "darwin") {
      // 내 녹음도 뷰어도 아니면 진행 중인 회의 개수를 보여 팝오버를 열기 전에 알 수 있게 한다.
      const activeCount = meetings.filter((meeting) =>
        meeting.state ? meeting.state === "IN_PROGRESS" : !meeting.ended
      ).length;
      const waiting = !recording && !viewing && activeCount > 0;
      tray.setTitle(
        elapsed && (viewing || !lifecycle.safe())
          ? elapsed
          : waiting
            ? `●${activeCount}`
            : "",
        { fontType: "monospacedDigit" }
      );
    }
    contextMenu = Menu.buildFromTemplate([
      { label: status, enabled: false },
      { type: "separator" },
      {
        label:
          recordingTarget || lifecycle.isRecording()
            ? t("현재 회의 열기")
            : t("HeyMoa 열기"),
        click: () => {
          sendAction("show-current");
        },
      },
      {
        label: t("녹음 일시정지"),
        enabled: lifecycle.isRecording(),
        click: () => {
          sendAction("stop");
        },
      },
      ...(meetings.length
        ? [
            { type: "separator" as const },
            { label: t("최근 회의록"), enabled: false },
            ...meetings.slice(0, 5).map((meeting) => ({
              label: meeting.title || t("제목 없는 회의"),
              click: () => openNote(meeting.noteId, true),
            })),
          ]
        : []),
      { type: "separator" },
      ...(panel?.openSettings
        ? [
            { label: t("설정…"), click: () => panel.openSettings?.() },
            { label: t("앱 업데이트…"), click: () => panel.openSettings?.() },
            { type: "separator" as const },
          ]
        : []),
      ...(loginItemSupported
        ? [
            {
              label: t("로그인 시 자동 실행"),
              type: "checkbox" as const,
              checked: openAtLogin,
              click: (item: { checked: boolean }) => {
                app.setLoginItemSettings({ openAtLogin: item.checked });
                // 실제로 적용된 값을 다시 읽는다. 시스템 설정에서 막혀 있으면 체크가 되돌아간다.
                openAtLogin = readOpenAtLogin();
                refresh();
              },
            },
          ]
        : []),
      { label: t("앱 종료"), click: () => void lifecycle.requestQuit() },
    ]);
    popover?.refresh();
  }
  function sendAction(
    action:
      | "show-current"
      | "show-app"
      | "stop"
      | "stop-viewing"
      | "list"
      | "show-recording"
      | "open-selection",
    tab?: "summary" | "transcript" | "context"
  ) {
    if (action === "show-app") {
      show();
      return;
    }
    if (action === "list") {
      selectMeeting(null);
      clearTimeline();
      noteFailed = false;
      popover.refresh();
      return;
    }
    if (action === "show-recording") {
      if (recordingTarget) chooseMeeting(recordingTarget, "recording");
      return;
    }
    if (action === "stop" && !lifecycle.isRecording()) return;
    if (action === "stop-viewing" && (lifecycle.isRecording() || !timeline))
      return;
    try {
      if (action === "open-selection") {
        show();
        if (
          selection &&
          !contents.isDestroyed() &&
          isTrustedUrl(contents.getURL(), origin)
        )
          contents.send(MEETING_CHANNELS.openNote, {
            workspaceId: selection.workspaceId,
            noteId: selection.noteId,
            tab: tab ?? (timeline?.detail?.ended ? "summary" : "transcript"),
          });
        return;
      }
      if (action === "stop-viewing") {
        selectMeeting(null);
        clearTimeline();
      }
      if (action === "show-current") {
        show();
        if (
          recordingTarget &&
          !contents.isDestroyed() &&
          isTrustedUrl(contents.getURL(), origin)
        ) {
          contents.send(MEETING_CHANNELS.openNote, {
            workspaceId: recordingTarget.workspaceId,
            noteId: recordingTarget.noteId,
            tab: "transcript",
          });
          return;
        }
        if (!lifecycle.isRecording()) return;
      }
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
      if (!onQuit?.()) app.quit();
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
          message: t("녹음 종료와 전송 완료를 아직 확인하지 못했습니다."),
          detail: t(
            "앱을 유지하고 현재 회의에서 상태를 확인해 주세요. 앱 종료 메뉴에서 종료 대기를 취소할 수 있습니다."
          ),
          buttons: [t("현재 회의 열기"), t("닫기")],
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
        language: getLanguage(),
        selection,
        selectionSource,
        recordingTarget,
        phase: view.phase,
        unknown: view.unknown,
        timeline,
        meetings,
        meetingsStatus,
        noteFailed,
        viewing: timeline !== null && !lifecycle.isRecording(),
        label: lifecycle.safe() && timeline ? t(VIEWING_LABEL) : view.label,
        elapsed: viewElapsed() ?? view.elapsed,
        warning:
          view.inputWarning ||
          // 녹음 중 청크의 짧은 전송 대기는 정상이며 경고 줄의 출몰이 본문을 밀어낸다.
          (view.pending && !["recording", "stopping"].includes(view.phase ?? "")
            ? t("전송 대기 중인 소리가 있습니다.")
            : null),
        canStop: lifecycle.isRecording(),
        stale:
          !noteFailed &&
          timeline !== null &&
          Date.now() - timelineAt > TIMELINE_STALE_MS,
      };
    },
    sendAction,
    openNote,
    panel
  );
  /** 팝오버가 목록에 있던 회의를 눌렀다. 목록에 없는 id 는 받지 않는다. */
  function openNote(noteId: string, reveal = false) {
    const target = meetings.find((meeting) => meeting.noteId === noteId);
    if (!target || disposed) return;
    try {
      noteFailed = false;
      if (
        window.isDestroyed() ||
        contents.isDestroyed() ||
        !isTrustedUrl(contents.getURL(), origin)
      )
        throw new Error("RECORDING_RENDERER_UNAVAILABLE");
      chooseMeeting(
        { workspaceId: target.workspaceId, noteId: target.noteId },
        "browse"
      );
      if (reveal) popover.revealNote?.(target.noteId, target.title);
      popover.refresh();
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
    selectMeeting(null);
    recordingTarget = null;
    listWorkspaceId = null;
    clearTimeline();
    meetings = [];
    meetingsStatus = "loading";
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
    // 시스템 설정에서 로그인 항목을 바꿨을 수 있다. 메뉴를 열 때 다시 읽는다.
    if (loginItemSupported) {
      const current = readOpenAtLogin();
      if (current !== openAtLogin) {
        openAtLogin = current;
        refresh();
      }
    }
    if (contextMenu) tray.popUpContextMenu(contextMenu);
  };
  tray.on("click", togglePopover);
  tray.on("right-click", showMenu);
  refresh();
  return {
    lifecycle,
    cancelUpdate() {
      if (disposed) return;
      allowQuit = false;
      lifecycle.resumeAfterUpdateFailure();
    },
    prepareForUpdate() {
      if (disposed || !lifecycle.safeForUpdate()) return false;
      allowQuit = true;
      return true;
    },
    refresh,
    setPanelOpacity: popover.setOpacity,
    reportTimeline(value: MeetingTimelineSnapshot | null) {
      // 녹음 중이 아니어도 받는다 — 내가 뷰어로 보는 진행 중 회의다(APP-1092).
      if (value?.detail) {
        if (
          !selection ||
          value.noteId !== selection.noteId ||
          value.detail.workspaceId !== selection.workspaceId
        )
          return;
        if (
          unavailableSelection === selection.requestId ||
          value.detail.selectionId !== selection.requestId
        )
          return;
      } else if (
        selection &&
        (!value ||
          value.noteId !== selection.noteId ||
          unavailableSelection === selection.requestId)
      )
        return;
      timeline = value;
      noteFailed = value === null;
      timelineAt = Date.now();
      popover.refresh();
    },
    reportActiveMeetings(value: ActiveMeeting[]) {
      meetings = value;
      meetingsAt = Date.now();
      meetingsStatus = "ready";
      popover.refresh();
    },
    meetingSelection: () => selection,
    meetingUnavailable(noteId: string, requestId?: number, retryable = false) {
      if (selection?.noteId !== noteId || selection?.requestId !== requestId)
        return;
      if (retryable) {
        if (unavailableSelection === selection.requestId) return;
        if (timeline)
          timeline = {
            ...timeline,
            reconnecting: true,
            ...(timeline.loading
              ? {
                  loading: false,
                  failed: true,
                  detail: timeline.detail
                    ? {
                        ...timeline.detail,
                        ...(timeline.detail.ended
                          ? {
                              summary: {
                                status: "failed" as const,
                                lead: "",
                                sections: [],
                              },
                            }
                          : {}),
                      }
                    : undefined,
                }
              : {}),
          };
        popover.refresh();
        return;
      }
      unavailableSelection = selection?.requestId ?? null;
      noteFailed = true;
      timeline = {
        noteId,
        title: t("회의록"),
        loading: false,
        failed: true,
        reconnecting: false,
        total: 0,
        items: [],
      };
      timelineAt = Date.now();
      popover.refresh();
    },
    reportRecordingTarget(value: MeetingTarget | null) {
      const changed =
        value?.noteId !== recordingTarget?.noteId ||
        value?.workspaceId !== recordingTarget?.workspaceId;
      recordingTarget = value;
      if (
        value &&
        changed &&
        (!selection ||
          (selectionSource === "recording" &&
            (selection.noteId !== value.noteId ||
              selection.workspaceId !== value.workspaceId ||
              unavailableSelection === selection.requestId)))
      )
        chooseMeeting(value, "recording");
      else popover.refresh();
    },
    reportMeetingList(value: MeetingListSnapshot) {
      const scopeChanged =
        value.workspaceId !== null && value.workspaceId !== listWorkspaceId;
      if (value.workspaceId !== null) listWorkspaceId = value.workspaceId;
      if (
        scopeChanged &&
        selection &&
        selection.workspaceId !== value.workspaceId &&
        (selectionSource !== "recording" || !recordingTarget)
      ) {
        selectMeeting(null);
        timeline = null;
        timelineAt = 0;
        noteFailed = false;
      }
      meetingsStatus = value.status;
      meetings = value.meetings;
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
