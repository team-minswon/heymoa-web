const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const origin = "https://heymoa.app";
const idle = {
  phase: "idle",
  startedAt: null,
  pendingMs: 0,
  microphone: null,
  systemAudio: null,
};
test("starting, stopping and failed sessions reject stale menu and popup stop commands", (t) => {
  const f = fixture(); t.after(() => f.adapter.dispose());
  f.adapter.lifecycle.update({ ...idle, phase: "recording" });
  f.tray.emit("right-click");
  const staleStop = f.tray.menu.find((item) => item.label === "녹음 중지");
  for (const phase of ["requesting-permission", "connecting", "stopping", "failed", "completed", "idle"]) {
    f.adapter.lifecycle.update({ ...idle, phase, pendingMs: 1000 });
    f.tray.emit("right-click");
    assert.equal(f.tray.menu.find((item) => item.label === "녹음 중지").enabled, false);
    staleStop.click(); f.popoverAction("stop");
  }
  assert.deepEqual(f.sent, []);
  f.adapter.lifecycle.update({ ...idle, phase: "recording" });
  staleStop.click();
  assert.deepEqual(f.sent, [["heymoa:recording-action", "stop"]]);
});
test("idle opens HeyMoa without inventing a current meeting", (t) => {
  const f = fixture(); t.after(() => f.adapter.dispose());
  f.tray.emit("right-click");
  f.tray.menu.find((item) => item.label === "HeyMoa 열기").click();
  assert.equal(f.shows, 1);
  assert.deepEqual(f.sent, [["heymoa:recording-action", "show-current"]]);
});
const snapshot = { noteId: "n1", title: "뷰어 회의", loading: false, failed: false, reconnecting: false, total: 0, items: [] };
test("a viewed meeting shows in the popover without a recording, keeps the window awake, and stops when the recording it replaced ends", (t) => {
  const f = fixture(); t.after(() => f.adapter.dispose());
  f.adapter.reportTimeline(snapshot);
  const view = f.read();
  assert.equal(view.timeline, snapshot);
  assert.equal(view.label, "회의 보는 중");
  assert.equal(view.canStop, false);
  f.interval();
  assert.equal(f.contents.throttling.at(-1), false);
  f.popoverAction("show-current");
  assert.equal(f.shows, 1);
  assert.deepEqual(f.sent, []);
  f.adapter.reportTimeline(null);
  assert.equal(f.read().timeline, null);
  f.interval();
  assert.equal(f.contents.throttling.at(-1), true);
  f.adapter.lifecycle.update({ ...idle, phase: "recording" });
  f.adapter.reportTimeline(snapshot);
  assert.equal(f.read().label, "녹음 중");
  f.adapter.lifecycle.update({ ...idle, phase: "idle" });
  assert.equal(f.read().timeline, null);
});
const meeting = { workspaceId: "w1", noteId: "n9", title: "진행 중", startedAt: 1000 };
test("active meetings reach the popover, open only listed notes in the trusted window, and expire without a heartbeat", (t) => {
  const f = fixture(); t.after(() => f.adapter.dispose());
  assert.equal(f.read().meetings.length, 0);
  f.adapter.reportActiveMeetings([meeting]);
  assert.equal(JSON.stringify(f.read().meetings), JSON.stringify([meeting]));
  f.open("unknown");
  assert.equal(f.shows, 0);
  f.open("n9");
  assert.equal(f.shows, 1);
  assert.equal(JSON.stringify(f.sent), JSON.stringify([["heymoa:open-note", { workspaceId: "w1", noteId: "n9" }]]));
  f.advance(151_000);
  f.interval();
  assert.equal(f.read().meetings.length, 0);
});
test("a viewed meeting shows how long it has run when the active list knows its start", (t) => {
  const f = fixture(); t.after(() => f.adapter.dispose());
  const start = Date.now() - 125_000;
  f.adapter.reportActiveMeetings([{ ...meeting, noteId: "n1", startedAt: start }]);
  f.adapter.reportTimeline({ ...snapshot, noteId: "n1" });
  assert.match(f.read().elapsed, /^2:0\d$/);
  f.interval();
  // 메뉴 막대 제목은 macOS 에만 있다.
  if (process.platform === "darwin") assert.match(f.tray.title, /^2:0\d$/);
  assert.match(f.tray.tooltip, /회의 보는 중 · 시작 후 2:0\d/);
  f.adapter.reportTimeline({ ...snapshot, noteId: "elsewhere" });
  assert.ok(!f.read().elapsed);
  f.interval();
  if (process.platform === "darwin") assert.equal(f.tray.title, "");
});
test("opening the main window pulls it to the current desktop on macOS and restores its Space pinning", (t) => {
  const f = fixture(); t.after(() => f.adapter.dispose());
  f.tray.emit("right-click");
  f.tray.menu.find((item) => item.label === "HeyMoa 열기").click();
  assert.equal(f.shows, 1);
  assert.equal(JSON.stringify(f.window.spaces), process.platform === "darwin" ? "[true,false]" : "[]");
});
test("stop-viewing ends a viewed meeting only: clears the popover timeline and tells the web, but never during my recording", (t) => {
  const f = fixture(); t.after(() => f.adapter.dispose());
  f.popoverAction("stop-viewing");
  assert.equal(f.sent.length, 0);
  f.adapter.reportTimeline(snapshot);
  assert.equal(f.read().viewing, true);
  f.popoverAction("stop-viewing");
  assert.equal(f.read().timeline, null);
  assert.equal(f.read().viewing, false);
  assert.equal(JSON.stringify(f.sent), JSON.stringify([["heymoa:recording-action", "stop-viewing"]]));
  f.adapter.lifecycle.update({ ...idle, phase: "recording" });
  f.adapter.reportTimeline(snapshot);
  f.popoverAction("stop-viewing");
  assert.equal(f.sent.length, 1);
});
function fixture() {
  const app = new EventEmitter(),
    window = new EventEmitter(),
    contents = new EventEmitter();
  let quits = 0,
    windowDestroyed = false,
    trayDestructions = 0,
    hides = 0,
    shows = 0,
    tray,
    interval,
    response = 0;
  let popoverAction, popoverRead, popoverOpen;
  let clockSkew = 0;
  let resolveAction;
  const nextAction = new Promise((resolve) => {
    resolveAction = resolve;
  });
  const sent = [],
    dialogs = [],
    answers = [];
  app.quit = () => {
    const event = {
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
    };
    app.emit("before-quit", event);
    if (!event.prevented) quits++;
  };
  window.isDestroyed = () => windowDestroyed;
  window.hide = () => hides++;
  window.spaces = [];
  window.setVisibleOnAllWorkspaces = (value) => window.spaces.push(value);
  window.show = () => shows++;
  window.focus = () => {};
  Object.defineProperty(window, "webContents", {
    get() {
      if (windowDestroyed) throw new TypeError("Object has been destroyed");
      return contents;
    },
  });
  contents.isDestroyed = () => windowDestroyed;
  contents.throttling = [];
  contents.setBackgroundThrottling = (value) => contents.throttling.push(value);
  contents.getURL = () => origin;
  contents.send = (...args) => {
    sent.push(args);
    resolveAction();
  };
  class Tray extends EventEmitter {
    constructor() {
      super();
      tray = this;
    }
    setToolTip(value) {
      this.tooltip = value;
    }
    setTitle(value) {
      this.title = value;
    }
    popUpContextMenu(value) {
      this.menu = value;
    }
    destroy() {
      if (this.destroyed) throw new TypeError("Object has been destroyed");
      trayDestructions++;
      this.destroyed = true;
    }
  }
  const image = {
    isEmpty: () => false,
    setTemplateImage() {},
    resize() {
      return this;
    },
  };
  const electron = {
    app,
    BrowserWindow: class {},
    dialog: {
      showMessageBox: async (_window, options) => {
        dialogs.push(options);
        return { response: answers.length ? answers.shift() : response };
      },
    },
    Menu: { buildFromTemplate: (value) => value },
    nativeImage: { createFromPath: () => image },
    Tray,
  };
  const module = { exports: {} };
  const filename = path.resolve(__dirname, "../dist/recording-tray.js");
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module,
    exports: module.exports,
    __dirname: path.dirname(filename),
    process,
    require: (name) =>
      name === "electron"
        ? electron
        : name === "./meeting-popover"
          ? { createMeetingPopover: (_tray, read, action, openNote) => { popoverAction = action; popoverRead = read; popoverOpen = openNote; return { refresh() {}, dispose() {}, toggle() {} }; } }
        : name.startsWith(".")
          ? require(path.resolve(path.dirname(filename), name))
          : require(name),
    Date: { now: () => Date.now() + clockSkew },
    setTimeout,
    clearTimeout,
    setInterval: (fn) => {
      interval = fn;
      return 1;
    },
    clearInterval: () => {
      interval = null;
    },
  });
  const adapter = module.exports.createRecordingTray(window, origin);
  return {
    app,
    window,
    contents,
    popoverAction,
    read: () => popoverRead(),
    open: (id) => popoverOpen(id),
    advance: (ms) => { clockSkew += ms; },
    adapter,
    tray,
    sent,
    nextAction,
    dialogs,
    answer: (...values) => answers.push(...values),
    destroyWindow() {
      windowDestroyed = true;
      window.emit("closed");
    },
    get trayDestructions() {
      return trayDestructions;
    },
    set response(value) {
      response = value;
    },
    get quits() {
      return quits;
    },
    get hides() {
      return hides;
    },
    get shows() {
      return shows;
    },
    get interval() {
      return interval;
    },
  };
}
test("window close hides rather than stops; current meeting and stop are separate fixed actions", () => {
  const f = fixture();
  let prevented = false;
  f.window.emit("close", {
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(f.hides, 1);
  assert.deepEqual(f.sent, []);
  f.adapter.lifecycle.update({ ...idle, phase: "recording" });
  f.tray.emit("right-click");
  f.tray.menu.find((item) => item.label === "현재 회의 열기").click();
  f.tray.menu.find((item) => item.label === "녹음 중지").click();
  assert.deepEqual(f.sent, [
    ["heymoa:recording-action", "show-current"],
    ["heymoa:recording-action", "stop"],
  ]);
  assert.equal(f.quits, 0);
  assert.equal(f.shows, 1);
  f.adapter.dispose();
});
test(
  "app before-quit is cancelled while active and safe completion re-enters quit without blocking close",
  { timeout: 1000 },
  async (t) => {
    const f = fixture();
    t.after(() => f.adapter.dispose());
    f.response = 1;
    f.adapter.lifecycle.update({ ...idle, phase: "recording", pendingMs: 20 });
    f.app.quit();
    assert.equal(f.quits, 0);
    await f.nextAction;
    assert.deepEqual(f.sent, [["heymoa:recording-action", "stop"]]);
    f.adapter.lifecycle.update({ ...idle, phase: "failed", pendingMs: 20 });
    assert.equal(f.quits, 0);
    f.adapter.lifecycle.update(idle);
    assert.equal(f.quits, 1);
    let blocked = false;
    f.window.emit("close", {
      preventDefault() {
        blocked = true;
      },
    });
    assert.equal(blocked, false);
    f.adapter.dispose();
  }
);
test("cancelled external navigation does not erase summary; replacement and renderer crash do", () => {
  const f = fixture();
  f.adapter.lifecycle.update(idle);
  f.contents.emit(
    "did-start-navigation",
    {},
    "https://external.test",
    false,
    true
  );
  assert.equal(f.adapter.lifecycle.safe(), true);
  f.contents.emit("did-start-navigation", {}, origin + "/w#tab", true, true);
  assert.equal(f.adapter.lifecycle.safe(), true);
  f.adapter.lifecycle.update({ ...idle, phase: "recording" });
  f.contents.emit("did-start-navigation", {}, origin + "/w", false, true);
  assert.equal(f.adapter.lifecycle.safe(), false);
  f.adapter.lifecycle.update(idle);
  f.contents.emit("render-process-gone");
  assert.equal(f.adapter.lifecycle.view().unknown, true);
  f.adapter.dispose();
});
test("closed window cleanup removes listeners and timers without querying its destroyed native getter", () => {
  const f = fixture();
  assert.equal(f.app.listenerCount("before-quit"), 1);
  // main.ts owns this callback; Electron has destroyed the window before closed.
  f.window.once("closed", () => f.adapter.dispose());
  assert.doesNotThrow(() => f.destroyWindow());
  assert.throws(() => f.window.webContents, /Object has been destroyed/);
  f.adapter.dispose();
  assert.equal(f.app.listenerCount("before-quit"), 0);
  assert.equal(f.window.listenerCount("close"), 0);
  assert.equal(f.contents.listenerCount("render-process-gone"), 0);
  assert.equal(f.contents.listenerCount("did-start-navigation"), 0);
  assert.equal(f.contents.listenerCount("did-navigate"), 0);
  assert.equal(f.contents.listenerCount("will-prevent-unload"), 0);
  assert.equal(f.interval, null);
  assert.equal(f.tray.destroyed, true);
  assert.equal(f.trayDestructions, 1);
});

test("renderer beforeunload is overridden only after native loss confirmation", async (t) => {
  const f = fixture();
  t.after(() => f.adapter.dispose());
  let prevented = false;
  f.contents.emit("will-prevent-unload", {
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, false);
  // The first dialog chooses discard, the second independently confirms it.
  f.adapter.lifecycle.captureRequested();
  f.answer(2, 1);
  await f.adapter.lifecycle.requestQuit();
  assert.equal(f.dialogs.length, 2);
  assert.equal(f.quits, 1);
  f.contents.emit("will-prevent-unload", {
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
});

test("hidden recording keeps timers active and idle restores background throttling", () => {
  const f = fixture();
  assert.deepEqual(f.contents.throttling, [true]);
  f.adapter.lifecycle.update({ ...idle, phase: "recording" });
  f.window.emit("close", { preventDefault() {} });
  f.interval();
  assert.deepEqual(f.contents.throttling, [true, false]);
  f.adapter.lifecycle.update(idle);
  assert.deepEqual(f.contents.throttling, [true, false, true]);
  f.adapter.dispose();
});


test("popover and context stop stay in the background while open and failure reveal the main window", (t) => {
  const f = fixture(); t.after(() => f.adapter.dispose());
  f.adapter.lifecycle.update({ ...idle, phase: "recording" });
  f.tray.emit("right-click");
  f.tray.menu.find((item) => item.label === "녹음 중지").click();
  f.popoverAction("stop");
  assert.equal(f.shows, 0);
  assert.deepEqual(f.sent, [["heymoa:recording-action", "stop"], ["heymoa:recording-action", "stop"]]);
  f.popoverAction("show-current");
  assert.equal(f.shows, 1);
  f.contents.send = () => { throw new Error("renderer send failed"); };
  f.popoverAction("stop");
  assert.equal(f.shows, 2);
});
