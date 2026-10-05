const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const vm = require("node:vm");

function fixture(t) {
  const windows = [], handlers = new Map(), actions = [];
  const view = { timeline: null, label: "녹음 중", elapsed: "1:00", warning: null, canStop: true, stale: false };
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
    setBounds(bounds) { this.bounds = bounds; }
    destroy() { this.destroyed = true; this.emit("closed"); }
  }
  const filename = path.resolve(__dirname, "../dist/meeting-popover.js");
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module, exports: module.exports, __dirname: path.dirname(filename),
    require: (name) => name === "electron" ? {
      BrowserWindow,
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler), removeHandler: (channel) => handlers.delete(channel) },
      screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 24, width: 1280, height: 776 } }) },
    } : name.startsWith(".") ? require(path.resolve(path.dirname(filename), name)) : require(name),
  });
  const popover = module.exports.createMeetingPopover({ getBounds: () => ({ x: 800, y: 0, width: 24, height: 24 }) }, () => view, (value) => actions.push(value));
  t.after(() => popover.dispose());
  return { popover, windows, handlers, actions, view,
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

test("only the live local popup main frame can read or invoke fixed actions", async (t) => {
  const f = fixture(t); f.popover.toggle();
  const window = f.windows[0]; window.finishLoad(); await settle();
  const read = f.handlers.get("heymoa:meeting-read"), action = f.handlers.get("heymoa:meeting-action");
  const event = f.event();
  assert.equal(read(event), f.view);
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
