const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

function fixture(t, platform = "darwin") {
  const handlers = new Map(), opened = [], writes = [];
  let status = "not-determined", asks = 0, saveFails = false, marker = "missing", window;
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super(); window = this; this.options = options;
      const session = { setPermissionRequestHandler: (f) => { this.permission = f; }, setPermissionCheckHandler: (f) => { this.check = f; }, webRequest: { onBeforeRequest: (f) => { this.request = f; } } };
      this.webContents = new EventEmitter();
      Object.assign(this.webContents, { session, mainFrame: { url: "" }, setWindowOpenHandler: (f) => { this.open = f; } });
    }
    isDestroyed() { return this.destroyed === true; }
    async loadFile(file) { this.webContents.mainFrame.url = pathToFileURL(file).href; }
    show() {} focus() {} close() { this.destroy(); }
    destroy() { this.destroyed = true; }
  }
  const module = { exports: {} };
  const filename = path.resolve(__dirname, "../dist/onboarding.js");
  const electron = { BrowserWindow, ipcMain: { handle: (key, f) => handlers.set(key, f), removeHandler: (key) => handlers.delete(key) }, shell: { openExternal: async (url) => opened.push(url) }, systemPreferences: { getMediaAccessStatus: (kind) => { assert.equal(kind, "microphone"); return status; }, askForMediaAccess: async (kind) => { assert.equal(kind, "microphone"); asks++; status = "granted"; return true; } } };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), { module, exports: module.exports, __dirname: path.dirname(filename), process: { platform }, require: (name) => name === "electron" ? electron : name === "node:fs/promises" ? {
    readFile: async () => { if (marker === "missing") throw Object.assign(new Error(), { code: "ENOENT" }); return marker; },
    mkdir: async () => {}, writeFile: async (file, text, options) => { if (saveFails) throw new Error("disk full"); writes.push({ file, text, options }); }, rename: async () => {},
  } : require(name) });
  const api = module.exports, intro = api.createOnboarding("/profile");
  t.after(() => intro.dispose());
  const sender = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
  return { intro, window, opened, writes, api,
    invoke: (action, event = sender) => handlers.get(api.ONBOARDING_CHANNEL)(event, action),
    get asks() { return asks; }, set status(value) { status = value; }, set saveFails(value) { saveFails = value; }, set marker(value) { marker = value; } };
}

test("local intro never prompts on read, authenticates exact file/frame and denies network/media", async (t) => {
  const f = fixture(t);
  assert.equal((await f.invoke("read")).microphone, "not-determined"); assert.equal(f.asks, 0);
  await assert.rejects(f.invoke("microphone", { sender: {}, senderFrame: f.window.webContents.mainFrame }), /UNTRUSTED/);
  await assert.rejects(f.invoke("microphone", { sender: f.window.webContents, senderFrame: { url: f.window.webContents.mainFrame.url } }), /UNTRUSTED/);
  await assert.rejects(f.invoke({ action: "microphone" }), /INVALID/);
  let granted; f.window.permission({}, "media", (value) => { granted = value; }); assert.equal(granted, false); assert.equal(f.window.check(), false);
  let blocked; f.window.request({ url: "https://heymoa.app" }, ({ cancel }) => { blocked = cancel; }); assert.equal(blocked, true);
  assert.equal(f.window.options.webPreferences.sandbox, true);
  assert.equal(f.window.options.webPreferences.partition, "heymoa-onboarding");
});
test("Mac prompts only undetermined microphone on click and denied permission opens settings", async (t) => {
  const f = fixture(t);
  assert.equal((await f.invoke("microphone")).microphone, "granted"); assert.equal(f.asks, 1);
  f.status = "denied"; await f.invoke("microphone"); assert.equal(f.asks, 1);
  assert.match(f.opened[0], /Privacy_Microphone$/);
  await f.invoke("audio-settings"); assert.match(f.opened[1], /Privacy_ScreenCapture$/);
  assert.equal((await f.invoke("read")).microphone, "denied");
});
test("Windows opens settings without unsupported prompt or pretending audio permission", async (t) => {
  const f = fixture(t, "win32"); f.status = "unknown";
  const result = await f.invoke("microphone"); assert.equal(result.microphone, "unknown"); assert.equal(f.asks, 0);
  await f.invoke("audio-settings"); assert.deepEqual(f.opened, ["ms-settings:privacy-microphone", "ms-settings:sound"]);
  assert.equal("systemAudio" in result, false);
});
test("completion is versioned and permission-independent; failed save does not finish", async (t) => {
  const f = fixture(t); let finished = false; f.intro.finished.then(() => { finished = true; });
  f.saveFails = true; await assert.rejects(f.invoke("complete"), /disk full/); assert.equal(finished, false);
  f.saveFails = false; await f.invoke("complete"); await Promise.resolve(); assert.equal(finished, true);
  assert.equal(f.writes[0].text, JSON.stringify({ version: 1, completed: true })); assert.equal(f.writes[0].options.mode, 0o600);
  await assert.rejects(f.invoke("read"), /UNTRUSTED/);
  assert.equal(await f.api.onboardingCompleted("/profile"), false);
  f.marker = JSON.stringify({ version: 1, completed: true }); assert.equal(await f.api.onboardingCompleted("/profile"), true);
  f.marker = JSON.stringify({ version: 2, completed: true }); assert.equal(await f.api.onboardingCompleted("/profile"), false);
});
