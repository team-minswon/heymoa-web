const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const vm = require("node:vm");

function fixture(t, preferences = { pinned: false, opacity: 1 }) {
  const windows = [], handlers = new Map(), actions = [];
  const saved = [];
  const displays = new EventEmitter();
  displays.getDisplayMatching = () => ({ workArea: { x: 0, y: 24, width: 1280, height: 776 } });
  const view = { meetings: [], timeline: null, label: "녹음 중", elapsed: "1:00", warning: null, canStop: true, stale: false };
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.destroyed = false;
      this.shows = this.hides = this.focuses = 0;
      this.sent = [];
      const contents = new EventEmitter();
      contents.mainFrame = { url: "about:blank" };
      contents.send = (...args) => this.sent.push(args);
      contents.session = {
        setPermissionRequestHandler: (handler) => { this.permissionRequest = handler; },
        setPermissionCheckHandler: (handler) => { this.permissionCheck = handler; },
        webRequest: { onBeforeRequest: (handler) => { this.beforeRequest = handler; } },
      };
      contents.setWindowOpenHandler = (handler) => { this.openWindow = handler; };
      this.webContents = contents;
      this.loaded = new Promise((resolve, reject) => { this.resolveLoad = resolve; this.rejectLoad = reject; });
      windows.push(this);
    }
    loadFile(file) { this.file = file; return this.loaded; }
    finishLoad() { this.webContents.mainFrame.url = pathToFileURL(this.file).href; this.resolveLoad(); }
    isDestroyed() { return this.destroyed; }
    show() { this.shows++; }
    hide() { this.hides++; }
    focus() { this.focuses++; }
    getBounds() { return this.bounds ?? { x: 0, y: 24, width: 420, height: 580 }; }
    setOpacity(value) { this.opacity = value; }
    setBounds(bounds) { this.bounds = bounds; this.boundsChanges = (this.boundsChanges ?? 0) + 1; }
    setVisibleOnAllWorkspaces(...args) { this.spaces = args; }
    setAlwaysOnTop(...args) { this.onTop = args; }
    destroy() { this.destroyed = true; this.emit("closed"); }
  }
  const filename = path.resolve(__dirname, "../dist/meeting-popover.js");
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module, exports: module.exports, __dirname: path.dirname(filename), process,
    require: (name) => name === "electron" ? {
      BrowserWindow,
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler), removeHandler: (channel) => handlers.delete(channel) },
      screen: displays,
    } : name.startsWith(".") ? require(path.resolve(path.dirname(filename), name)) : require(name),
  });
  const popover = module.exports.createMeetingPopover({ getBounds: () => ({ x: 800, y: 0, width: 24, height: 24 }) }, () => view, (value) => actions.push(value), undefined, { preferences, save: async value => { saved.push(JSON.parse(JSON.stringify(value))); } });
  t.after(() => popover.dispose());
  return { popover, windows, handlers, actions, view, saved, displays,
    event(window = windows.at(-1)) { return { sender: window.webContents, senderFrame: window.webContents.mainFrame }; },
  };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test("loading never shows a blank popup and preserves the latest toggle or hide intent", async (t) => {
  const f = fixture(t);
  f.popover.toggle();
  const window = f.windows[0];
  f.popover.toggle(); f.popover.refresh();
  assert.equal(window.shows, 0); assert.equal(window.sent.length, 0);
  window.finishLoad(); await settle();
  assert.equal(window.shows, 0);
  f.popover.toggle(); assert.equal(window.shows, 1); assert.equal(window.focuses, 1);
  window.emit("blur");
  f.popover.toggle(); assert.equal(window.shows, 2);
  window.destroy();
  f.popover.toggle(); f.popover.hide();
  f.windows[1].finishLoad(); await settle();
  assert.equal(f.windows[1].shows, 0);
});

test("on macOS the popup follows the desktop (Space) whose menu bar icon was clicked", (t) => {
  const f = fixture(t); f.popover.toggle();
  const window = f.windows[0];
  if (process.platform === "darwin") {
    assert.equal(window.spaces[0], true);
    assert.equal(window.spaces[1].visibleOnFullScreen, true);
    assert.equal(window.spaces[1].skipTransformProcessType, true);
    assert.equal(window.onTop[1], "pop-up-menu");
  } else assert.equal(window.spaces, undefined);
});

test("only the live local popup main frame can read or invoke fixed actions", async (t) => {
  const f = fixture(t); f.popover.toggle();
  const window = f.windows[0]; window.finishLoad(); await settle();
  const read = f.handlers.get("heymoa:meeting-read"), action = f.handlers.get("heymoa:meeting-action");
  const event = f.event();
  assert.equal(read(event).label, f.view.label);
  assert.equal(read(event).panel.pinned, false);
  for (const invalid of [ { ...event, sender: {} }, { ...event, senderFrame: { url: event.senderFrame.url } } ]) {
    assert.throws(() => read(invalid), /UNTRUSTED_MEETING_REQUEST/);
    assert.throws(() => action(invalid, "stop"), /UNTRUSTED_MEETING_REQUEST/);
  }
  event.senderFrame.url = "https://heymoa.app";
  assert.throws(() => read(event), /UNTRUSTED_MEETING_REQUEST/);
  event.senderFrame.url = pathToFileURL(window.file).href;
  assert.throws(() => read(event, {}), /INVALID_MEETING_REQUEST/);
  assert.throws(() => action(event, { action: "stop" }), /INVALID_MEETING_ACTION/);
  f.view.canStop = false;
  assert.throws(() => action(event, "stop"), /INVALID_MEETING_ACTION/);
  f.view.canStop = true;
  action(event, "stop"); action(event, "show-current"); action(event, "hide");
  assert.deepEqual(f.actions, ["stop", "show-current"]);
  f.view.viewing = true;
  const hidesBefore = window.hides;
  action(event, "stop-viewing");
  assert.deepEqual(f.actions, ["stop", "show-current", "stop-viewing"]);
  assert.equal(window.hides, hidesBefore); // 보기 종료는 팝오버를 닫지 않는다
  window.destroy();
  assert.throws(() => read(event), /UNTRUSTED_MEETING_REQUEST/);
});

test("popup denies network, permissions and navigation and disposes pending loads and IPC handlers", async (t) => {
  const f = fixture(t); f.popover.toggle(); const window = f.windows[0];
  assert.equal(window.options.webPreferences.partition, "heymoa-meeting");
  for (const key of ["contextIsolation", "sandbox", "webSecurity"]) assert.equal(window.options.webPreferences[key], true);
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  let allowed;
  window.permissionRequest({}, "media", (value) => { allowed = value; });
  assert.equal(allowed, false); assert.equal(window.permissionCheck(), false);
  for (const [url, cancel] of [["https://heymoa.app", true], [pathToFileURL(path.resolve(__dirname, "../../package.json")).href, true], [pathToFileURL(window.file).href, false]]) {
    let result; window.beforeRequest({ url }, (value) => { result = value.cancel; }); assert.equal(result, cancel);
  }
  assert.equal(window.openWindow().action, "deny");
  for (const event of ["will-navigate", "will-attach-webview"]) {
    let prevented = false; window.webContents.emit(event, { preventDefault() { prevented = true; } }); assert.equal(prevented, true);
  }
  f.popover.dispose(); f.popover.dispose();
  assert.equal(f.handlers.size, 0); assert.equal(window.destroyed, true);
  window.finishLoad(); await settle(); f.popover.toggle();
  assert.equal(window.shows, 0); assert.equal(f.windows.length, 1);
});

test("failed load and renderer crash destroy the popup so the next toggle can recreate it", async (t) => {
  const f = fixture(t); f.popover.toggle(); f.windows[0].rejectLoad(new Error("load failed")); await settle();
  assert.equal(f.windows[0].destroyed, true);
  f.popover.toggle(); const window = f.windows[1]; window.finishLoad(); await settle();
  assert.equal(window.shows, 1);
  window.webContents.emit("render-process-gone"); assert.equal(window.destroyed, true);
  f.popover.toggle(); assert.equal(f.windows.length, 3);
});

test("pin survives outside clicks, dragging restores clamped position, opacity persists, explicit close still works", async t => {
  const f = fixture(t); f.view.canStop = false;
  f.popover.toggle(); const window = f.windows[0]; window.finishLoad(); await settle();
  assert.equal(window.bounds.height, 580);
  const action = f.handlers.get("heymoa:meeting-action");
  await action(f.event(), { action: "set-panel", pinned: true });
  await f.popover.setOpacity(0.7);
  window.emit("blur"); assert.equal(window.hides, 0); assert.equal(window.opacity, 0.7);
  await action(f.event(), "settings"); assert.equal(window.hides, 0);
  window.bounds = { x: 3000, y: -100, width: 420, height: 280 }; window.emit("moved");
  await new Promise(setImmediate); f.popover.hide(); f.popover.toggle();
  assert.equal(window.bounds.x, 860); assert.equal(window.bounds.y, 24);
  assert.equal(f.saved.at(-1).pinned, true); assert.equal(f.saved.at(-1).opacity, 0.7);
  for (const invalid of [{ opacity: 0.7 }, { opacity: 0.1 }, { opacity: NaN }, { pinned: "true" }, { pinned: true, url: "https://evil.test" }, {}])
    assert.throws(() => action(f.event(), { action: "set-panel", ...invalid }), /INVALID_MEETING_ACTION/);
  await action(f.event(), "hide"); assert.equal(window.hides, 2);
  await action(f.event(), { action: "set-panel", pinned: false });
  window.emit("blur"); assert.equal(window.hides, 3);
  f.popover.dispose(); assert.equal(f.displays.listenerCount("display-removed"), 0);
});

test("settings opacity rejects out-of-range values and is never writable through popup IPC", async t => {
  const f = fixture(t); f.popover.toggle(); f.windows[0].finishLoad(); await settle();
  for (const value of [NaN, Infinity, 0.19, 1.01]) await assert.rejects(f.popover.setOpacity(value), /INVALID_PANEL_REQUEST/);
  assert.throws(() => f.handlers.get("heymoa:meeting-action")(f.event(), { action: "set-panel", pinned: true, opacity: .8 }), /INVALID_MEETING_ACTION/);
  await f.popover.setOpacity(.2); assert.equal(f.windows[0].opacity, .2);
});


test("recording content and status refreshes never resize, reposition, refocus or reopen the panel", async t => {
  const f = fixture(t, { pinned: true, opacity: 1 });
  f.popover.toggle(); const window = f.windows[0]; window.finishLoad(); await settle();
  const before = JSON.stringify(window.getBounds()), changes = window.boundsChanges ?? 0;
  for (const [timeline, warning] of [[null, null], [{ loading: true, items: [] }, null], [{ loading: false, items: [{ id: 'a' }] }, '마이크 음소거'], [{ loading: false, items: [{ id: 'b' }] }, null], [null, null]]) {
    Object.assign(f.view, { timeline, warning }); f.popover.refresh();
    assert.equal(JSON.stringify(window.getBounds()), before);
  }
  assert.equal(window.boundsChanges ?? 0, changes);
  assert.equal(window.shows, 1); assert.equal(window.focuses, 1); assert.equal(window.hides, 0);
  f.displays.getDisplayMatching = () => ({ workArea: { x: -300, y: 24, width: 300, height: 400 } });
  f.displays.emit('display-metrics-changed');
  assert.equal(window.bounds.width, 300); assert.equal(window.bounds.height, 400);
  const clamped = JSON.stringify(window.bounds); f.popover.refresh();
  assert.equal(JSON.stringify(window.bounds), clamped);
});


test("default browse and ended-note selection stay in the popup, and recording stop never hides it", async t => {
 const f = fixture(t, { pinned: true, opacity: 1 });
 f.view.canStop = false; f.view.meetings = [{ workspaceId: 'w1', noteId: 'past', title: '지난 회의', startedAt: 1000, ended: true }];
 f.popover.toggle(); const window = f.windows[0]; window.finishLoad(); await settle();
 const action = f.handlers.get('heymoa:meeting-action'), read = f.handlers.get('heymoa:meeting-read');
 assert.equal(read(f.event()).timeline, null); assert.equal(window.bounds.height, 580);
 await action(f.event(), { action: 'open-note', noteId: 'past' });
 assert.equal(read(f.event()).timeline.noteId, 'past'); assert.equal(read(f.event()).timeline.loading, true);
 f.view.selection = null; f.popover.refresh(); assert.equal(read(f.event()).timeline, null, 'scope reset removes the opening placeholder immediately');
 f.view.selection = { workspaceId: 'w1', noteId: 'past', requestId: 1 };
 await action(f.event(), { action: 'open-note', noteId: 'past' });
 assert.equal(window.hides, 0);
 f.view.timeline = { noteId: 'past', title: '지난 회의', loading: false, failed: false, reconnecting: false, total: 0, items: [], detail: { ended: true } }; f.popover.refresh();
 assert.equal(read(f.event()).timeline.detail.ended, true);
 await action(f.event(), 'list'); assert.equal(read(f.event()).timeline, null);
 assert.equal(window.bounds.height, 580); assert.equal(window.hides, 0);
 f.view.canStop = true; f.popover.refresh();
 await action(f.event(), 'stop'); assert.deepEqual(f.actions, ['list', 'stop']); assert.equal(window.hides, 0);
 f.view.canStop = false; f.popover.refresh(); assert.equal(window.hides, 0); assert.equal(window.bounds.height, 580);
 assert.throws(() => action(f.event(), { action: 'open-note', noteId: 'unknown' }), /INVALID_MEETING_ACTION/);
 assert.throws(() => action(f.event(), { action: 'open-note', noteId: 'past', url: 'https://evil.test' }), /INVALID_MEETING_ACTION/);
});
