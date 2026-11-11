const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const tick = () => new Promise((resolve) => setImmediate(resolve));
const idle = {
  phase: "idle",
  startedAt: null,
  pendingMs: 0,
  microphone: null,
  systemAudio: null,
};

// Execute the shipped main entry and its modules together. Only Electron's OS
// boundary is replaced; broker, session adapter, IPC admission and tray are real.
async function fixture(t, overriddenProfiles = true, introCompleted = true, options = {}) {
  const app = new EventEmitter();
  const ipcMain = new EventEmitter();
  const handlers = new Map(),
    requests = [],
    dialogs = [],
    opened = [],
    windows = [];
  let ready;
  const readiness = new Promise((resolve) => {
    ready = resolve;
  });
  app.whenReady = () => readiness;
  // Model Electron's name-derived defaults and explicit path overrides. The
  // profiles intentionally differ, as a caller may override session storage.
  let name = "@heymoa/desktop";
  const paths = new Map(overriddenProfiles ? [
    ["userData", "/isolated-qa/existing-user-profile"],
    ["sessionData", "/isolated-qa/existing-cookie-profile"],
  ] : []);
  const profileAtLock = [];
  app.getName = () => name;
  app.setName = (value) => {
    name = value;
  };
  app.getPath = (key) => paths.get(key) ?? `/default-profile/${name}`;
  app.setPath = (key, value) => paths.set(key, value);
  app.requestSingleInstanceLock = () => {
    profileAtLock.push(app.getPath("userData"));
    return true;
  };
  app.isPackaged = true;
  app.getVersion = () => "0.1.4";
  let updateInstalls = 0;
  const updater = new EventEmitter();
  updater.checkForUpdates = async () => { updater.emit("checking-for-update"); updater.emit("update-available", { version: "0.1.5" }); return { downloadPromise: updater.autoDownload ? updater.downloadUpdate() : undefined }; };
  updater.downloadUpdate = async () => { updater.emit("update-downloaded", { version: "0.1.5" }); return []; };
  updater.quitAndInstall = () => { updateInstalls++; app.quit(); };
  app.getLocale = () => options.locale ?? "ko-KR";
  app.setAsDefaultProtocolClient = () => true;
  let quits = 0,
    answer = 0;
  const event = () => ({
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
  });
  app.quit = () => {
    const before = event();
    app.emit("before-quit", before);
    if (before.prevented) return;
    for (const window of windows) {
      if (window.destroyed) continue;
      const closing = event();
      window.emit("close", closing);
      if (closing.prevented) return;
      window.destroyed = true;
      window.emit("closed");
    }
    const will = event();
    app.emit("will-quit", will);
    if (!will.prevented) {
      quits++;
      app.emit("quit");
    }
  };
  const jar = {
    cookies: { get: async () => options.cookie ? [{ value: options.cookie }] : [], set: async (cookie) => { options.lastCookie = cookie; } },
    webRequest: { onBeforeRequest() {} },
    setDisplayMediaRequestHandler() {},
    setPermissionCheckHandler() {},
    setPermissionRequestHandler() {},
    async fetch(url, options) {
      requests.push({
        url,
        body: JSON.parse(options.body),
        signal: options.signal,
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: url.endsWith("/start")
            ? {
                authorizeUrl: `https://api.heymoa.app/v1/auth/desktop/authorize?ticket=${"t".repeat(43)}`,
              }
            : { message: "ok" },
        }),
      };
    },
  };
  const sessionProfiles = [];
  let applicationMenu;
  const sent = [];
  let rejectCaptureLoad;
  class BrowserWindow extends EventEmitter {
    constructor() {
      super();
      this.webContents = new EventEmitter();
      Object.assign(this.webContents, {
        setBackgroundThrottling() {},
        session: jar,
        mainFrame: { url: "https://heymoa.app" },
        isDestroyed: () => this.destroyed ?? false,
        getURL: () => "https://heymoa.app",
        setWindowOpenHandler() {},
        send: (...value) => sent.push(value),
      });
      windows.push(this);
    }
    isDestroyed() {
      return this.destroyed ?? false;
    }
    isMinimized() {
      return false;
    }
    setTitle(title) { this.title = title; }
    show() { this.shows = (this.shows ?? 0) + 1; }
    focus() {}
    hide() {}
    restore() {}
    async loadFile(file) {
      this.loadedFile = file;
      this.webContents.mainFrame.url = require("node:url").pathToFileURL(file).href;
    }
    close() { this.destroyed = true; this.emit("closed"); }
    async loadURL(url) {
      this.loadedURL = url;
      if (url.startsWith("file:"))
        await new Promise((_resolve, reject) => { rejectCaptureLoad = reject; });
    }
    destroy() {
      this.destroyed = true;
      this.webContents.emit("destroyed");
    }
  }
  class Tray extends EventEmitter {
    setToolTip() {}
    setTitle() {}
    setContextMenu() {}
    destroy() {}
  }
  const image = {
    isEmpty: () => false,
    setTemplateImage() {},
    resize() {
      return this;
    },
  };
  ipcMain.handle = (channel, callback) => handlers.set(channel, callback);
  ipcMain.removeHandler = (channel) => handlers.delete(channel);
  const electron = {
    app,
    screen: new EventEmitter(),
    ipcMain,
    BrowserWindow,
    Tray,
    nativeImage: { createFromPath: () => image },
    Menu: { buildFromTemplate: (value) => value, setApplicationMenu(value) { applicationMenu = value; } },
    session: {
      fromPartition(partition) {
        sessionProfiles.push({ partition, storage: app.getPath("sessionData") });
        return jar;
      },
    },
    shell: { openExternal: async (url) => opened.push(url) },
    systemPreferences: { getMediaAccessStatus: () => "granted", askForMediaAccess: async () => true },
    dialog: {
      showErrorBox() {
        assert.fail("unexpected startup failure");
      },
      async showMessageBox(_window, options) {
        dialogs.push(options);
        return { response: answer };
      },
    },
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    vm.runInNewContext(
      fs.readFileSync(filename, "utf8"),
      {
        module,
        exports: module.exports,
        __dirname: path.dirname(filename),
        process: {
          platform: "darwin",
          arch: "arm64",
          argv: [],
          env: {},
          getSystemVersion: () => "14.2",
        },
        Buffer,
        URL,
        AbortController,
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        require: (name) =>
          name === "node:fs/promises"
            ? { ...require(name), readFile: async (file) => JSON.stringify(file.endsWith("preferences.json") ? { language: options.savedLanguage } : file.endsWith("updates.json") ? { automatic: options.automatic ?? false } : { version: 1, completed: introCompleted }), mkdir: async () => {}, writeFile: async () => {}, rename: async () => {} }
          : name === "./update-runtime"
            ? { autoUpdater: updater }
          : name === "electron"
            ? electron
            : name.startsWith(".")
              ? load(
                  require.resolve(path.resolve(path.dirname(filename), name))
                )
              : require(name),
      },
      { filename }
    );
    return module.exports;
  }
  load(path.resolve(__dirname, "../dist/main.js"));
  ready();
  await tick();
  const window = windows[0];
  assert.ok(window, "main's ready handler creates the window and tray");
  const sender = {
    sender: window.webContents,
    senderFrame: window.webContents.mainFrame,
  };
  const invoke = (channel, payload, event = sender) => handlers.get(channel)(event, payload);
  t.after(() => {
    for (const current of windows) {
      if (!current.isDestroyed()) current.emit("closed");
    }
    app.emit("will-quit", {});
    app.removeAllListeners();
  });
  return {
    app,
    updater,
    get updateInstalls() { return updateInstalls; },
    windows,
    get applicationMenu() { return applicationMenu; },
    sent,
    invoke,
    requests,
    dialogs,
    opened,
    profileAtLock,
    sessionProfiles,
    failCaptureLoad: () => rejectCaptureLoad(new Error("capture load failed")),
    get quits() {
      return quits;
    },
    set answer(value) {
      answer = value;
    },
  };
}

test("main quits a never-started landing without a web summary or loss confirmation", async (t) => {
  const f = await fixture(t);
  f.app.quit();
  await tick();
  assert.equal(f.quits, 1);
  assert.equal(f.dialogs.length, 0);
});

test("main protects capture acquisition and failed acquisition until a fresh drained report", async (t) => {
  const f = await fixture(t);
  f.invoke("heymoa:recording-summary", idle);
  const acquisition = f.invoke("heymoa:capture-begin", undefined);
  const rejected = assert.rejects(acquisition, /AUDIO_CAPTURE_FAILED/);
  f.app.quit();
  await tick();
  assert.equal(f.quits, 0);
  assert.equal(f.dialogs.length, 1);
  f.failCaptureLoad();
  await rejected;
  f.app.quit();
  await tick();
  assert.equal(f.quits, 0);
  assert.equal(f.dialogs.length, 2);
  f.invoke("heymoa:recording-summary", idle);
  f.app.quit();
  await tick();
  assert.equal(f.quits, 1);
  assert.equal(f.dialogs.length, 2);
});

test("main's quit wait needs both native capture disposal and a drained web report in either arrival order", async (t) => {
  for (const reportFirst of [true, false]) {
    await t.test(reportFirst ? "drained report before disposal" : "disposal before drained report", async (t) => {
      const f = await fixture(t);
      const acquisition = f.invoke("heymoa:capture-begin", undefined);
      const rejected = assert.rejects(acquisition, /AUDIO_CAPTURE_CANCELLED/);
      f.invoke("heymoa:recording-summary", { ...idle, phase: "connecting", pendingMs: 20 });
      f.answer = 1;
      f.app.quit();
      await tick();
      assert.equal(f.quits, 0);
      assert.equal(f.dialogs.length, 1);
      const report = () => f.invoke("heymoa:recording-summary", { ...idle, phase: "completed" });
      const dispose = async () => {
        await f.invoke("heymoa:capture-end", undefined);
        await rejected;
      };
      if (reportFirst) report();
      else await dispose();
      assert.equal(f.quits, 0, "one completion signal must not authorize audio loss");
      if (reportFirst) await dispose();
      else report();
      await tick();
      assert.equal(f.quits, 1);
      assert.equal(f.dialogs.length, 1, "safe completion must not ask for discard");
    });
  }
});

test("main uses the product display name while retaining the existing lock and cookie profiles", async (t) => {
  const f = await fixture(t);
  assert.equal(f.app.getName(), "HeyMoa");
  assert.equal(f.app.getPath("userData"), "/isolated-qa/existing-user-profile");
  assert.equal(f.app.getPath("sessionData"), "/isolated-qa/existing-cookie-profile");
  assert.deepEqual(f.profileAtLock, ["/isolated-qa/existing-user-profile"]);
  assert.deepEqual(f.sessionProfiles, [
    { partition: "persist:heymoa", storage: "/isolated-qa/existing-cookie-profile" },
  ]);
});

test("main retains the legacy name-derived profile for an existing default installation", async (t) => {
  const f = await fixture(t, false);
  assert.equal(f.app.getName(), "HeyMoa");
  assert.equal(f.app.getPath("userData"), "/default-profile/@heymoa/desktop");
  assert.equal(f.app.getPath("sessionData"), "/default-profile/@heymoa/desktop");
  assert.deepEqual(f.profileAtLock, ["/default-profile/@heymoa/desktop"]);
  assert.deepEqual(f.sessionProfiles, [
    { partition: "persist:heymoa", storage: "/default-profile/@heymoa/desktop" },
  ]);
});

test("main preserves an OAuth request when the recording quit dialog is cancelled", async (t) => {
  const f = await fixture(t);
  f.invoke("heymoa:recording-summary", { ...idle, phase: "recording" });
  const outcome = f.invoke("heymoa:auth-login", undefined);
  await tick();
  assert.equal(f.opened.length, 1);
  f.app.quit();
  await tick();
  assert.equal(f.quits, 0);
  assert.equal(f.dialogs.length, 1);
  assert.equal(
    f.requests[0].signal.aborted,
    false,
    "a vetoed quit must not revoke pending PKCE state"
  );
  f.app.emit(
    "open-url",
    { preventDefault() {} },
    `app.heymoa:/auth/callback?state=${f.requests[0].body.state}&code=${"c".repeat(43)}`
  );
  assert.equal((await outcome).status, "success");
  assert.equal(
    f.requests[1].url,
    "https://api.heymoa.app/v1/auth/desktop/exchange"
  );
});

test("main cancels pending OAuth only when a safe quit actually proceeds", async (t) => {
  const f = await fixture(t);
  f.invoke("heymoa:recording-summary", idle);
  const outcome = f.invoke("heymoa:auth-login", undefined);
  await tick();
  f.app.quit();
  await tick();
  assert.equal(f.quits, 1);
  assert.equal((await outcome).status, "cancelled");
  assert.equal(f.requests[0].signal.aborted, true);
  assert.equal(f.dialogs.length, 0);
});


test("first run gates hosted web until intro completion and activation cannot bypass it", async (t) => {
  const f = await fixture(t, true, false);
  assert.equal(f.windows.length, 1);
  assert.match(f.windows[0].loadedFile, /onboarding.html$/);
  assert.equal(f.windows[0].loadedURL, undefined);
  f.app.emit("activate");
  f.app.emit("second-instance", {}, []);
  assert.equal(f.windows.length, 1);
  await f.invoke("heymoa:onboarding", "complete");
  await tick();
  assert.equal(f.windows.length, 2);
  assert.equal(f.windows[1].loadedURL, "https://heymoa.app");
  assert.equal(f.windows[0].isDestroyed(), true);
  assert.equal(f.quits, 0);
  assert.deepEqual(f.requests, []);
});


test("onboarding language selection reaches first hosted page and invalid IPC cannot change it", async (t) => {
  const f = await fixture(t, true, false);
  await f.invoke("heymoa:onboarding", "language-en");
  await f.invoke("heymoa:onboarding", "complete"); await tick();
  assert.equal(f.windows[1].loadedURL, "https://heymoa.app/en");
  const sender = { sender: f.windows[1].webContents, senderFrame: f.windows[1].webContents.mainFrame };
  await assert.rejects(f.invoke("heymoa:language", "fr", sender), /INVALID_LANGUAGE/);
  const login = f.invoke("heymoa:auth-login", undefined, sender); await tick();
  assert.equal(f.requests[0].body.language, "en");
  f.app.quit(); await tick(); await login;
});


test("upgrade keeps an existing Korean web choice on English OS; explicit onboarding overrides its stale cookie", async (t) => {
  const upgrade = await fixture(t, true, true, { locale: "en-US", cookie: "ko" });
  assert.equal(upgrade.windows[0].loadedURL, "https://heymoa.app");
  const options = { cookie: "ko" };
  const intro = await fixture(t, true, false, options);
  await intro.invoke("heymoa:onboarding", "language-en");
  await intro.invoke("heymoa:onboarding", "complete"); await tick();
  assert.equal(options.lastCookie.value, "en");
  assert.equal(intro.windows[1].loadedURL, "https://heymoa.app/en");
});

test("update IPC admits only the trusted main frame and rechecks active/pending/unknown state before installation", async (t) => {
  const f = await fixture(t);
  for (const [channel, payload] of [["heymoa:update-state"], ["heymoa:update-check"], ["heymoa:update-restart"], ["heymoa:update-automatic", true]]) {
    assert.throws(() => f.invoke(channel, payload, { sender: {}, senderFrame: null }), /UNTRUSTED/);
  }
  assert.throws(() => f.invoke("heymoa:update-automatic", "true"), /INVALID/);
  assert.throws(() => f.invoke("heymoa:update-check", { url: "https://evil.test" }), /INVALID/);
  f.invoke("heymoa:update-check"); await tick();
  assert.equal(f.invoke("heymoa:update-state").status, "ready");
  f.invoke("heymoa:update-restart"); assert.equal(f.updateInstalls, 0);
  for (const summary of [{ ...idle, phase: "recording" }, { ...idle, phase: "failed", pendingMs: 10 }]) {
    f.invoke("heymoa:recording-summary", summary); f.invoke("heymoa:update-restart"); assert.equal(f.updateInstalls, 0);
  }
  f.invoke("heymoa:recording-summary", idle);
  f.windows[0].webContents.emit("render-process-gone");
  f.invoke("heymoa:update-restart"); assert.equal(f.updateInstalls, 0);
  f.invoke("heymoa:recording-summary", idle); f.invoke("heymoa:update-restart");
  assert.equal(f.updateInstalls, 1); assert.equal(f.quits, 1);
});

test("opt-in automatic update applies on safe normal quit; confirmed audio discard never installs an update", async (t) => {
  const f = await fixture(t, true, true, { automatic: true }); await tick();
  f.invoke("heymoa:recording-summary", idle); f.app.quit(); await tick();
  assert.equal(f.updateInstalls, 1);
  const unsafe = await fixture(t, true, true, { automatic: true }); await tick();
  unsafe.invoke("heymoa:recording-summary", { ...idle, phase: "recording" });
  unsafe.answer = 2; unsafe.app.quit(); await tick();
  assert.equal(unsafe.updateInstalls, 0);
});

test("native settings open without navigating the main web window and reject untrusted requests", async t => {
  const f = await fixture(t);
  assert.throws(() => f.invoke("heymoa:open-preferences", {}, { sender:{}, senderFrame:{} }), /UNTRUSTED/);
  assert.throws(() => f.invoke("heymoa:open-preferences", {}), /INVALID_PREFERENCES_REQUEST/);
  const menu = f.applicationMenu[0].submenu;
  menu.find(item => item.label === "설정…").click();
  await tick();
  assert.equal(f.windows.length, 2);
  const mainShows = f.windows[0].shows; f.app.emit("activate");
  assert.equal(f.windows[0].shows, mainShows);
  assert.equal(f.sent.some(([channel]) => channel === "heymoa:open-settings"), false);
  menu.find(item => item.label === "앱 업데이트…").click();
  assert.equal(f.windows.length, 2); assert.equal(f.quits, 0);
});
